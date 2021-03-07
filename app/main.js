/*
 *
 *  NETWORKING
 *
 */



Object.defineProperty(String.prototype, 'hashCode', {
  value: function() {
    var hash = 0, i, chr;
    for (i = 0; i < this.length; i++) {
      chr   = this.charCodeAt(i);
      hash  = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
      console.log(hash);
    }
    var strhash = ("00000000" + Math.abs(hash).toString(16));
    return strhash.substr(strhash.length-8, strhash.length);
  }
});


function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}


let UNIQUE_ID;// = uuidv4();//String(1.00000000001**(new Date().getTime())%1).hashCode()

if(true || document.cookie === "") {
    UNIQUE_ID = uuidv4();
    //document.cookie = "unique_id="+UNIQUE_ID;
} else {
    UNIQUE_ID = document.cookie.split(";")[0].split("=")[1];
}



// Config variables: change them to point to your own servers
const SIGNALING_SERVER_URL = 'wss://rtc-static.tk:5000/ws';
const RECORDING_SERVER_URL = 'wss://rtc-static.tk:1000'; // TODO
//const SIGNALING_SERVER_URL = 'http://localhost:9999';
//const TURN_SERVER_URL = 'localhost:3478';
const STUN_SERVER_URL = 'turn.rtc-static.tk:3478';
const TURN_SERVER_URL = 'turn.rtc-static.tk:3478';
const TURN_SERVER_USERNAME = 'rtcstatic';
const TURN_SERVER_CREDENTIAL = 'rtcstatic';
// WebRTC config: you don't have to change this for the example to work
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
    /*{
      urls: 'stun:' + STUN_SERVER_URL + '?transport=udp',
    },
    {
      urls: 'turn:' + TURN_SERVER_URL + '?transport=udp',
      username: TURN_SERVER_USERNAME,
      credential: TURN_SERVER_CREDENTIAL
    }*/
  ],
  //iceTransportPolicy: 'relay'
};
console.log(PC_CONFIG);
//const PC_CONFIG = {};



function sendStartRecording() {
	const data = {
		type: "start",
		ssid: "subscriber_session"
	};
	const params = {
		body: data,
		method: "POST
	};
	fetch(url, params)
	.then(res => console.log(res.json()))
}

function sendStopRecording() {
	data = {
		type: "stop",
		ssid: "subscriber_session"
	}
	const params = {
		body: data,
		method: "POST
	};
	fetch(url, params)
	.then(res => console.log(res.json()))
}


const signalLocal = new Signal.IonSFUJSONRPCSignal(
  SIGNALING_SERVER_URL
);

const clientLocal = new IonSDK.Client(signalLocal, PC_CONFIG);
signalLocal.onopen = () => clientLocal.join("test session");


const signalSubscribers = new Signal.IonSFUJSONRPCSignal(
  SIGNALING_SERVER_URL
);

const clientSubscribers = new IonSDK.Client(signalSubscribers, PC_CONFIG);
signalSubscribers.onopen = () => clientSubscribers.join("subscriber_session");


async function waitForClient() {

  const poll = resolve => {
    if(clientLocal.transports) resolve();
    else setTimeout(_ => poll(resolve), 400);
  }

  return new Promise(poll);
}

let control;

async function controlDataChannel() {
  await waitForClient();
  control = await clientLocal.createDataChannel("control");
  console.log("Control data channel created");
}

controlDataChannel();

/*
 *
 *  Streams
 *
 */

defaultConstraints = {
  resolution: "qvga",
  audio: true
};

audioConstraints = true;


let localStreams = {};


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

  //localStream.addTrack(track);
  //playbackStream.addTrack(track);

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



function addLocalStream(id = null) {
  getLocalStreamElement(id).srcObject = localStreams[id];
  //getLocalStreamElement(id).muted = true;
  console.log("Local video track added");
}

function removeLocalStream(id) {
  localStreams[id].getTracks().forEach((t) => t.stop());
  delete localStreams[id]
  removeLocalStreamElement(id);
}


let subscribers = {};

clientSubscribers.ontrack = (track, stream) => {
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
        code = videos[id].playState == 1 ? " -4 " : " -3 "
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



/*
 *
 *  UI
 *
 */

const remoteStreamContainer = document.getElementById("remote-streams");
const localStreamContainer = document.getElementById("local-streams");

function getRemoteStreamElement(id) {
  let elem = document.getElementById("remote-stream-"+id)
  if (elem === null) {
    let div = document.createElement("div");
    div.classList.add("video");
    let newstr = document.createElement("video");
    newstr.autoplay = true;
    newstr.id = "remote-stream-"+id;
    newstr.playsinline = true;
    div.appendChild(newstr);
    remoteStreamContainer.appendChild(div);
    elem = newstr;
  }
  return elem
}

function removeRemoteStreamElement(id) {
  remoteStreamContainer.removeChild(getRemoteStreamElement(id).parentElement);
}

function getLocalStreamElement(id) {
  let elem = document.getElementById("local-stream-"+id)
  if (elem === null) {
    let div = document.createElement("div");
    div.classList.add("local","stream-container");

    let newstr = document.createElement("video");
    newstr.classList.add("local","video");
    newstr.autoplay = true;
    newstr.muted = true;
    newstr.id = "local-stream-"+id;
    newstr.playsinline = true;

    let contDiv = createStreamControls(newstr, id);
    div.appendChild(newstr);
    div.appendChild(contDiv);

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
    clientLocal.publish(strElem.srcObject);
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






/*
 *
 * BUTTONS
 *
 */

let addStreamButton = document.getElementById("add-stream");
let recordButton = document.getElementById("record");
let chatElement = document.getElementById("chat-read");
let messageElement = document.getElementById("chat-write");





async function getCamera() {
  let id = await getLocalStream();
  if(!id) {
    alert("Could not get local stream");
  } else {
    addLocalStream(id);
  }
}

async function getScreen() {
  let id = await getDisplayStream();
  if(!id) {
    alert("Could not get local display");
  } else {
    addLocalStream(id);
  }
}

let videos = {};

async function getVideo() {
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
    event.target.playVideo();
  }

  function onPlayerStateChange(event) {
    if (contDiv.children[0].on)
      control.send(videoId + " " + event.data + " " + videos[videoId].getCurrentTime());
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


addStreamButton.onclick = async () => {
  document.getElementById("add-stream-popup").classList.add("show");
}

recordButton.on = false
recordButton.onclick = () => {
	if (recordButton.on) {
		recordButton.on = false;
		sendStopRecording();
		disable.style.backgroundColor = "black";
	} else {
		recordButton.on = true;
		sendStartRecording();
		disable.style.backgroundColor = "lightblue";
	}
}

document.getElementById("close-popup").onclick = () => {
  document.getElementById("add-stream-popup").classList.remove("show");
}

document.getElementById("get-camera").onclick = getCamera;
document.getElementById("get-screen").onclick = getScreen;
document.getElementById("get-video").onclick = getVideo;

function displayStats() {
  document.getElementById("stats-id").textContent = "ID de sala: " + roomId;
  document.getElementById("stats-number").textContent = "Conectados: " + (streams.childElementCount);
}




let chat;

async function startChat() {
  await waitForClient();
  chat = clientLocal.createDataChannel("chat");
  chat.onmessage = (msg) => {
    chatElement.value += msg.data;
  }
  messageElement.onkeyup = (ev) => {
    if(ev.keyCode == 13) {
      chat.send("Host:\n" + messageElement.value);
      chatElement.value += "Tú:\n";
      chatElement.value += messageElement.value;
      messageElement.value = "";
    }
  }
}

startChat();
getCamera();
//start();


/*
 *
 *  Startup and joining
 *
 */
/*
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

let roomId = urlParams.get('room_id');
let hostId = null;

if(roomId != null) {
  connect((success, error) => {
    if(success) {
      document.getElementById("overlay").style.display = "none";
      cameraElement.click();
    } else {
      alert(error);
    }
  });
}

document.getElementById("create").onclick = (event) => {
  hostId = Math.random().toString(16).substr(2, 8);
  roomId = hostId.hashCode();
  console.log(hostId);
  console.log(roomId);
  connect((success, error) => {
    if(success) {
      document.getElementById("overlay").style.display = "none";
      cameraElement.click();
    } else {
      alert(error);
    }
  });
};


document.getElementById("join").onclick = (event) => {
  roomId = document.getElementById("room-id").value;
  connect((success, error) => {
    if(success) {
      document.getElementById("overlay").style.display = "none";
      cameraElement.click();
    } else {
      alert(error);
    }
  });
};*/




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
