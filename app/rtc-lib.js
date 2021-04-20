/*
 *
 *  CONFIGURATION
 *
 */

// Config variables: change them to point to your own servers
const SIGNALING_SERVER_URL = 'wss://rtc-static.tk:5000/ws';
const RECORDING_SERVER_URL = 'https://rtc-static.tk:9999';
const IDEN_SERVER_URL = 'https://rtc-static.tk:9999';
const STUN_SERVER_URL = 'turn.rtc-static.tk:3478';
const TURN_SERVER_URL = 'turn.rtc-static.tk:3478';
const TURN_SERVER_USERNAME = 'rtcstatic';
const TURN_SERVER_CREDENTIAL = 'rtcstatic';

// WebRTC config
// If you are testing on localhost, you can just use PC_CONFIG = {}
const PC_CONFIG = {
  iceServers: [
    {
      urls: 'turn:' + TURN_SERVER_URL + '?transport=tcp',
      username: TURN_SERVER_USERNAME,
      credential: TURN_SERVER_CREDENTIAL
    },
    {
      urls: 'stun:' + STUN_SERVER_URL + '?transport=tcp',
    },
  ],
};
//console.log(PC_CONFIG);
//const PC_CONFIG = {};


/*
 *
 *  IDENTIFICATION
 *
 */

// Find identifiers in URL params
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

const roomId = urlParams.get('room_id');
const subId = urlParams.get('subject');
const hostId = urlParams.get('host');

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}


let UNIQUE_ID;


/*
 *
 *  NETWORKING
 *
 */

// Sends the unique id to the AVP client for stream-id association
async function sendIden() {
	data = {
		subjectId: UNIQUE_ID,
		streamId: localStreamId,
		ssid: roomId + "_sub"
	}
	const params = {
		body: JSON.stringify(data),
		method: "POST"
	};
	res = await fetch(IDEN_SERVER_URL + '/iden', params)
	return true
}

// Asks the AVP client to start recording
async function sendStartRecording() {
	const data = {
		type: "start",
		ssid: roomId + "_sub"
	};
	const params = {
		body: JSON.stringify(data),
		method: "POST"
	};
	res = await fetch(RECORDING_SERVER_URL + '/record', params)
	res = await res.json()
	console.log(res)
	return res.ok
}

// Asks the AVP client to stop recording
async function sendStopRecording() {
	data = {
		type: "stop",
		ssid: roomId + "_sub"
	}
	const params = {
		body: JSON.stringify(data),
		method: "POST"
	};
	res = await fetch(RECORDING_SERVER_URL + '/record', params)
	res = await res.json()
	console.log(res)
	return res.ok
}

// Asks the AVP client to register the recording timestamp of a
// video timestamp
async function sendRecordTs(ts) {
	data = {
		ts: ts,
		ssid: roomId + "_sub"
	}
	const params = {
		body: JSON.stringify(data),
		method: "POST"
	};
	res = await fetch(RECORDING_SERVER_URL + '/ts', params)
	res = await res.json()
	console.log(res)
	return res.ok
}

// SFU signals and client

const signalHost = new Signal.IonSFUJSONRPCSignal(
  SIGNALING_SERVER_URL
);

const clientHost = new IonSDK.Client(signalHost, PC_CONFIG);
signalHost.onopen = () => clientHost.join(roomId + "_host");


const signalSub = new Signal.IonSFUJSONRPCSignal(
  SIGNALING_SERVER_URL
);

const clientSub = new IonSDK.Client(signalSub, PC_CONFIG);
signalSub.onopen = () => clientSub.join(roomId + "_sub");


// Waits until client is connected
async function waitForClient() {

  const poll = resolve => {
    if(clientHost.transports) resolve();
    else setTimeout(_ => poll(resolve), 400);
  }

  return new Promise(poll);
}


// Control channel: allows sending video playback commands and other
// control communication between host and subs
let control;

async function createControlDataChannel() {
  await waitForClient();
  control = await clientHost.createDataChannel("control");
  console.log("Control data channel created");
}

// For subs, sets up the control logic
function setupControlResponse() {
  control.onmessage = (msg) => {
    [video, ev, ts] = msg.data.split(" ");
    console.log(video + " " + ev);
    console.log(msg.data);
    switch(ev) {
    case "-4":
    case "-3":
      if (!(video in videos)) {
        getVideo(video, parseInt(ev)+2, ts);
      }
      break;
    case "-2":
    case "-1":
      getVideo(video, ev, ts);
      break;
    case "0":
      videos[video].stopVideo();
      el = document.getElementById("player="+video).parentElement;
      el.parentElement.removeChild(el);
    case "1":
      videos[video].seekTo(ts);
      videos[video].playVideo();
      break;
    case "2":
      videos[video].pauseVideo();
      videos[video].seekTo(ts);
      break;
    }
  }
}


/*
 *
 *  STREAMS
 *
 */

defaultConstraints = {
  resolution: "qvga",
  audio: true
};

audioConstraints = true;

let localStreams = {};
let localStreamId;

let subscribers = {};


const getLocalStream = async (constraints = null) => {

  if (constraints === null) 
    constraints = defaultConstraints;

  gum = await IonSDK.LocalStream.getUserMedia(constraints).catch(
    (error) => {
      alert("Could not access local stream: " + error);
    }
  );

  if(!gum)
    return null;

  localStreams[gum.id] = gum;
  localStreamId = gum.id;

  return gum.id;
}

const getDisplayStream = async (constraints = null) => {
  gum = await IonSDK.LocalStream.getDisplayMedia({video: true, audio: true}).catch(
    (error) => {
      alert("Could not access screen: " + error);
    }
  )

  console.log("Got display stream " + gum.id);

  if(!gum)
    return null;

  localStreams[gum.id] = gum;
  console.log("Got display stream " + gum.id);
  return gum.id;
};


function setupClientHost() {
  clientHost.ontrack = (track, stream) => {
    console.log("got track", track.id, "for stream", stream.id);
    stream.onremovetrack = () => {
      console.log("Track ended");
      removeRemoteStreamElement(stream.id);
    }
    strElem = getRemoteStreamElement(stream.id);
    if (strElem.srcObject === null) {
      strElem.srcObject = stream;
    } else {
      strElem.srcObject.addTrack(track);
    }
  };
}

function addLocalStream(id = null, host = false) {
  getLocalStreamElement(id, host).srcObject = localStreams[id];
  //getLocalStreamElement(id).muted = true;
  console.log("Local video track added");
}

function removeLocalStream(id) {
  localStreams[id].getTracks().forEach((t) => t.stop());
  delete localStreams[id]
  removeLocalStreamElement(id);
}

function setupClientSub() {
  clientSub.ontrack = (track, stream) => {
    console.log("got track", track.id, "for stream", stream.id);
    stream.onremovetrack = () => {
      console.log("Track ended");
      removeRemoteStreamElement(stream.id);
    }
    strElem = getRemoteStreamElement(stream.id);
    if (!(stream.id in subscribers)) {
      console.log("New subscriber");
      subscribers[stream.id] = null;
      for (id in videos) {
        if (videos[id].getIframe().parentElement.children[1].children[0].on) {
          code = videos[id].getPlayerState() == 1 ? " -4 " : " -3 "
          control.send(id + code + videos[id].getCurrentTime());
          console.log(id + code + videos[id].getCurrentTime());
        }
      }
    }
    if (strElem.srcObject === null) {
      strElem.srcObject = stream;
    } else {
      strElem.srcObject.addTrack(track);
    }
  };
}



/*
 *
 *  UI
 *
 */

const remoteStreamContainer = document.getElementById("remote-streams");
let localStreamContainer;

function setLocalStreamContainer(host = false) {
	if (host)
		localStreamContainer = document.getElementById("local-streams");
	else
		localStreamContainer = remoteStreamContainer;
}


function getRemoteStreamElement(id, host = false) {
  let elem = document.getElementById("remote-stream-"+id)
  if (elem === null) {
    let div = document.createElement("div");
	if (host)
      div.classList.add("video");
	else
	  div.classList.add("stream-container");

    let newstr = document.createElement("video");
    newstr.autoplay = true;
    newstr.id = "remote-stream-"+id;
    newstr.playsinline = true;
	newstr.muted = false;
    div.appendChild(newstr);
    remoteStreamContainer.appendChild(div);
    elem = newstr;
  }
  return elem
}

function removeRemoteStreamElement(id) {
  remoteStreamContainer.removeChild(getRemoteStreamElement(id).parentElement);
}

function getLocalStreamElement(id, host = false) {
  let elem = document.getElementById("local-stream-"+id)
  if (elem === null) {
    let div = document.createElement("div");
	if (host)
      div.classList.add("local","stream-container");
	else
      div.classList.add("stream-container");
	
    let newstr = document.createElement("video");
    newstr.classList.add("local","video");
    newstr.autoplay = true;
    newstr.muted = true;
    newstr.id = "local-stream-"+id;
    newstr.playsinline = true;

	if (host) {
      let contDiv = createStreamControls(newstr, id);
      div.appendChild(newstr);
      div.appendChild(contDiv);
	} else {
      div.appendChild(newstr);
	}

    localStreamContainer.appendChild(div);
    elem = newstr;
  }
  return elem
}

function createStreamControls(strElem, id) {
  let cont = document.createElement("div");
  cont.classList.add("stream-controls");

  cont.innerHTML = `
      <div class="publish button">
        <div class="icon">
          <i class="fa fa-wifi" aria-hidden="true"></i>
        </div
      </div>`;

  cont.innerHTML += `
      <div class="camera button">
        <div class="icon">
          <i class="fa fa-video-camera" aria-hidden="true"></i>
        </div
      </div>`;

  cont.innerHTML += `
      <div class="mute button">
        <div class="icon">
          <i class="fa fa-microphone" aria-hidden="true"></i>
        </div
      </div>`;

  cont.innerHTML += `
      <div class="remove button">
        <div class="icon">
          <i class="fa fa-times" aria-hidden="true"></i>
        </div
      </div>`;



  let publish = cont.children[0];
  publish.on = false;
  publish.onclick = () => publishStream(strElem, publish);

  let disable = cont.children[1];
  disable.on = false;
  disable.onclick = () => disableStream(strElem, disable);

  let mute = cont.children[2];
  mute.on = false;
  mute.onclick = () => muteStream(strElem, mute);

  let remove = cont.children[3];
  remove.onclick = () => {
    if (strElem.srcObject != undefined) {
      strElem.srcObject.unpublish();
      removeLocalStream(id);
    } else {
      videos[id].stopVideo();
      delete videos[id]
      localStreamContainer.removeChild(document.getElementById("player="+id).parentElement);
    }
  }

  return cont;
}

function publishStream(strElem, publish) {
  if(strElem.srcObject == undefined) {
    publishVideo(strElem.id, publish);
    return;
  }
  if (publish.on) {
    strElem.srcObject.unpublish();
    publish.on = false;
    publish.style.backgroundColor = "black";
  } else {
    clientHost.publish(strElem.srcObject);
    publish.on = true;
    publish.style.backgroundColor = "lightblue";
  }
}

function publishVideo(id, publish) {
  id = id.split("=")[1];
  if (publish.on) {
    console.log("unpublish "+id);
    control.send(id + " 0");
    publish.on = false;
    publish.style.backgroundColor = "black";
  } else {
    console.log("publish "+id + " " + videos[id].getCurrentTime());
    if(videos[id].getPlayerState() == 1) {
      control.send(id + " -2 " + videos[id].getCurrentTime());
    } else {
      control.send(id + " -1");
    }
    publish.on = true;
    publish.style.backgroundColor = "lightblue";
  }
}

function disableStream(strElem, disable) {
  if (disable.on) {
    strElem.srcObject.getVideoTracks()[0].enabled = true;
    strElem.srcObject.unmute('video');
    disable.on = false;
    disable.style.backgroundColor = "lightblue";
  } else {
    strElem.srcObject.getVideoTracks()[0].enabled = false;
    strElem.srcObject.mute('video');
    disable.on = true;
    disable.style.backgroundColor = "black";
  }
}

function muteStream(strElem, mute) {
  if (mute.on) {
    strElem.srcObject.unmute('audio');
    mute.on = false;
    mute.style.backgroundColor = "lightblue";
  } else {
    strElem.srcObject.mute('audio');
    mute.on = true;
    mute.style.backgroundColor = "black";
  }
}

function removeLocalStreamElement(id) {
  localStreamContainer.removeChild(getLocalStreamElement(id).parentElement);
}


let videos = {};


function getVideoSub(id, playState, ts) {
  let div = document.createElement("div");
  div.classList.add("stream-container");

  let newstr = document.createElement("div");
  newstr.id = "player="+id;
  newstr.classList.add("local","video");

  let overlay = document.createElement("div");
  overlay.classList.add("player-overlay");

  let overlay2 = document.createElement("div");
  overlay.classList.add("player-overlay");
  overlay2.onclick = () => {videos[id].playVideo(); videos[id].stopVideo();};

  let fs = document.createElement("div");
  fs.classList.add("fullscreen-button");

  let icon = document.createElement("i");
  icon.classList.add("fa", "fa-square-o");
  icon.ariaHidden = true;

  div.resizeObs = new ResizeObserver((entries) => {
    videos[id].setSize(entries[0].contentRect.width, entries[0].contentRect.height);
  });

  div.resizeObs.observe(div);

  fs.appendChild(icon);
  overlay.appendChild(fs);
  overlay.appendChild(overlay2);
  div.appendChild(overlay);

  fs.onclick = () => {
    if (!document.fullscreenElement) {
      div.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  div.appendChild(newstr);
  remoteStreamContainer.appendChild(div);

  function onPlayerReady(event) {
	event.target.setPlaybackQuality('hd720');
    event.target.seekTo(ts);
    event.target.playVideo();
    if (playState != -2)
	  event.target.stopVideo();
  }

  player = new YT.Player('player='+id, {
    style: "height: auto; width: 100%;",
    videoId: id,
    playerVars: { 'controls': 0 },
    disablekb: 1,
    events: {
      'onReady': onPlayerReady,
      //'onStateChange': onPlayerStateChange
    }
  });

  videos[id] = player;
}


async function getVideoHost() {
  videoId = document.getElementById("video-id").value;

  let div = document.createElement("div");
  div.classList.add("local","stream-container");

  let newstr = document.createElement("div");
  newstr.id = "player="+videoId;
  newstr.classList.add("local","video");

  let contDiv = createStreamControls(newstr, videoId);
  div.appendChild(newstr);
  div.appendChild(contDiv);

  localStreamContainer.appendChild(div);

  function onPlayerReady(event) {
    //event.target.playVideo();
  }

  function onPlayerStateChange(event) {
    if (contDiv.children[0].on)
      control.send(videoId + " " + event.data + " " + videos[videoId].getCurrentTime());
	  if (recordButton.on)
	    sendRecordTs(videoId + " " + event.data + " " + videos[videoId].getCurrentTime());
  }

  player = new YT.Player('player='+videoId, {
    style: "height: auto; width: 80%;",
    videoId: videoId,
    //playerVars: { 'autoplay': 1, 'controls': 0 },
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });

  videos[videoId] = player;
}



/*
 *
 * CHAT
 *
 */

let chat;

async function startChat(host = false) {
  await waitForClient();
  chat = clientHost.createDataChannel("chat");
  chat.onmessage = (msg) => {
    chatElement.value += msg.data;
  }
  messageElement.onkeyup = (ev) => {
    if(ev.keyCode == 13) {
      chat.send((host ? "Host:\n" : UNIQUE_ID + ':\n') + messageElement.value);
      chatElement.value += "Tú:\n";
      chatElement.value += messageElement.value;
      messageElement.value = "";
    }
  }
}



var tag = document.createElement('script');

tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// 3. This function creates an <iframe> (and YouTube player)
//    after the API code downloads.
let youtubeReady = false;
var player;
function onYouTubeIframeAPIReady() {
  youtubeReady = true;
}
