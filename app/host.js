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
    addLocalStream(id, host=true);
  }
}

async function getScreen() {
  let id = await getDisplayStream();
  if(!id) {
    alert("Could not get local display");
  } else {
    addLocalStream(id, host=true);
  }
}


addStreamButton.onclick = async () => {
  document.getElementById("add-stream-popup").classList.add("show");
}

recordButton.on = false
recordButton.onclick = async () => {
	if (recordButton.on) {
		recordButton.on = false;
		recordButton.style.backgroundColor = "red";
		res = await sendStopRecording();
		if (res)
			recordButton.style.backgroundColor = "black";
	} else {
		recordButton.on = true;
		recordButton.style.backgroundColor = "red";
		res = await sendStartRecording();
		if (res)
			recordButton.style.backgroundColor = "lightblue";
	}
}

document.getElementById("close-popup").onclick = () => {
  document.getElementById("add-stream-popup").classList.remove("show");
}

document.getElementById("get-camera").onclick = getCamera;
document.getElementById("get-screen").onclick = getScreen;
document.getElementById("get-video").onclick = getVideoHost;


/*
 *
 * STARTUP
 *
 */

function setupHost() {
	UNIQUE_ID = hostId || uuidv4();
	setLocalStreamContainer(host = true);
	startChat();
	createControlDataChannel();
	setupClientSub();
	getCamera();
}

setupHost();
