/*
 *
 * BUTTONS
 *
 */

let localStreamElement;

let cameraButton = document.getElementById("camera");
let micButton = document.getElementById("mic");
let chatButton = document.getElementById("chat-button");
let chatElement = document.getElementById("chat-read");
let messageElement = document.getElementById("chat-write");
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

async function start() {
  let ls = await getLocalStream();
  if(!ls) {
    alert("Could not get local stream");
  } else {
    await waitForClient();
 	localStreamElement = getLocalStreamElement()
    localStreamElement.srcObject = localStreams[localStreamId];
    clientSub.publish(localStreams[localStreamId]);
	sendIden();
	console.log("Publishing...")
  }
}

async function setupSub() {
	UNIQUE_ID = hostId || uuidv4();
	setLocalStreamContainer();
	startChat()
	setupClientHost();
	await createControlDataChannel();
	setupControlResponse();
	await start();
}

setupSub();
