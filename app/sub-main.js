/*
 *
 *  Startup and joining
 *
 */

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

let roomId = urlParams.get('room_id');
let subId = urlParams.get('subject');
//let hostId = null;


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
    UNIQUE_ID = subId || uuidv4();
    //document.cookie = "unique_id="+UNIQUE_ID;
} else {
    UNIQUE_ID = document.cookie.split(";")[0].split("=")[1];
}



// Config variables: change them to point to your own servers
const SIGNALING_SERVER_URL = 'wss://rtc-static.tk:5000/ws';
const IDEN_SERVER_URL = 'https://rtc-static.tk:9999';
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


async function sendIden() {
	data = {
		subjectId: subId,
		streamId: localStream.id,
		ssid: roomId + "_sub"
	}
	const params = {
		body: JSON.stringify(data),
		method: "POST"
	};
	res = await fetch(IDEN_SERVER_URL + '/iden', params)
	//res = await res.json()
	//console.log(res)
	//return res.ok
	return true
}


const signalLocal = new Signal.IonSFUJSONRPCSignal(
  SIGNALING_SERVER_URL
);

const clientLocal = new IonSDK.Client(signalLocal, PC_CONFIG);
signalLocal.onopen = () => clientLocal.join(roomId + "_host");


const signalPublish = new Signal.IonSFUJSONRPCSignal(
  SIGNALING_SERVER_URL
);

const clientPublish = new IonSDK.Client(signalPublish, PC_CONFIG);
signalPublish.onopen = () => clientPublish.join(roomId + "_sub");


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


let localStream;


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

  localStream = gum;
  return true;
}



clientLocal.ontrack = (track, stream) => {
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


/*
 *
 *  UI
 *
 */

const streamContainer = document.getElementById("streams");

function getRemoteStreamElement(id) {
  let elem = document.getElementById("remote-stream-"+id)
  if (elem === null) {
    let div = document.createElement("div");
    div.classList.add("stream-container");
    let newstr = document.createElement("video");
    newstr.autoplay = true;
    newstr.id = "remote-stream-"+id;
    newstr.playsinline = true;
    newstr.muted = false;
    div.appendChild(newstr);
    streamContainer.appendChild(div);
    elem = newstr;
  }
  return elem
}

function removeRemoteStreamElement(id) {
  streamContainer.removeChild(getRemoteStreamElement(id).parentElement);
}

function getLocalStreamElement() {
  let elem = document.getElementById("local-stream")
  if (elem === null) {
    let div = document.createElement("div");
    div.classList.add("stream-container");

    let newstr = document.createElement("video");
    newstr.autoplay = true;
    newstr.muted = true;
    newstr.id = "local-stream";
    newstr.playsinline = true;

    div.appendChild(newstr);
    streamContainer.appendChild(div);
    elem = newstr;
  }
  return elem
}

const localStreamElement = getLocalStreamElement();



function disableStream(strElem, disable) {
  if (disable.on) {
    strElem.srcObject.getVideoTracks()[0].enabled = true;
    disable.on = false;
    disable.style.backgroundColor = "lightblue";
  } else {
    strElem.srcObject.getVideoTracks()[0].enabled = false;
    disable.on = true;
    disable.style.backgroundColor = "black";
  }
}

function muteStream(strElem, mute) {
  if (mute.on) {
    strElem.srcObject.getAudioTracks()[0].enabled = true;
    mute.on = false;
    mute.style.backgroundColor = "lightblue";
  } else {
    strElem.srcObject.getAudioTracks()[0].enabled = false;
    mute.on = true;
    mute.style.backgroundColor = "black";
  }
}


let videos = {};


function getVideo(id, playState, ts) {
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
      div/*.children[1]*/.requestFullscreen();
      //videos[id].setSize(screen.width, screen.height);
    } else {
      //videos[id].setSize(0,0);
      document.exitFullscreen();
      //setTimeout(() => videos[id].setSize(div.clientWidth, 9*div.clientWidth/16), 100);
    }
  }

  div.appendChild(newstr);
  streamContainer.appendChild(div);

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





/*
 *
 * BUTTONS
 *
 */

let cameraButton = document.getElementById("camera");
let micButton = document.getElementById("mic");
let chatButton = document.getElementById("chat-button");
chatButton.on = false;

cameraButton.onclick = () => disableStream(localStreamElement, cameraButton);
micButton.onclick = () => muteStream(localStreamElement, micButton);

chatButton.onclick = () => {
  if (chatButton.on) {
    chatButton.on = false;
    chatButton.style.backgroundColor = "black";
    document.getElementById("chat").classList.remove("show");
    document.getElementById("main").classList.remove("shrink");
  } else {
    chatButton.on = true;
    chatButton.style.backgroundColor = "lightblue";
    document.getElementById("chat").classList.add("show");
    document.getElementById("main").classList.add("shrink");
  }
}


function displayStats() {
  document.getElementById("stats-id").textContent = "ID de sala: " + roomId;
  document.getElementById("stats-number").textContent = "Conectados: " + (streams.childElementCount);
}


async function start() {
  let ls = await getLocalStream();
  if(!ls) {
    alert("Could not get local stream");
  } else {
    await waitForClient();
    localStreamElement.srcObject = localStream;
    clientPublish.publish(localStream);
	sendIden();
	console.log("Publishing...")
  }
}


let chatElement = document.getElementById("chat-read");
let messageElement = document.getElementById("chat-write");

let chat;

async function startChat() {
  await waitForClient();
  chat = clientLocal.createDataChannel("chat");
  chat.onmessage = (msg) => {
    chatElement.value += msg.data;
  }
  messageElement.onkeyup = (ev) => {
    if(ev.keyCode == 13) {
      chat.send(UNIQUE_ID + ":\n" + messageElement.value);
      chatElement.value += "Tú:\n";
      chatElement.value += messageElement.value;
      messageElement.value = "";
    }
  }
}

startChat();


start();


/*
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
