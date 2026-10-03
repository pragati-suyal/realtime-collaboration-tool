const socket = io({
  autoConnect: false
});


/* ================= ELEMENTS ================= */

const $ = id => document.getElementById(id);

const loginScreen = $("loginScreen");
const app = $("app");

const nameInput = $("nameInput");
const roomInput = $("roomInput");
const loginError = $("loginError");

const createRoomBtn = $("createRoomBtn");
const joinBtn = $("joinBtn");

const editor = $("editor");
const lineNumbers = $("lineNumbers");

const usersList = $("usersList");
const userCount = $("userCount");

const languageSelect = $("languageSelect");

const roomLabel = $("roomLabel");
const roomIdDisplay = $("roomIdDisplay");

const connectionStatus = $("connectionStatus");

const typingText = $("typingText");

const saveStatus = $("saveStatus");

const messages = $("messages");
const chatForm = $("chatForm");
const chatInput = $("chatInput");
const chatCount = $("chatCount");

const clearBtn = $("clearBtn");
const downloadBtn = $("downloadBtn");

const copyLinkBtn = $("copyLinkBtn");
const leaveBtn = $("leaveBtn");

const fileName = $("fileName");


/* ================= VARIABLES ================= */

let roomId = "";
let username = "";

let selfId = "";

let currentUsers = [];

let localVersion = 0;

let typingTimer = null;

let typingUsers = new Set();

let suppressChange = false;


/* ================= CONNECTION STATUS ================= */

function setConnectionStatus(online) {

  connectionStatus.textContent =
    online
      ? "● Connected"
      : "● Offline";

  connectionStatus.className =
    `status ${online ? "online" : "offline"}`;
}


/* ================= URL ROOM ================= */

function getRoomFromUrl() {

  const params =
    new URLSearchParams(
      window.location.search
    );

  return params.get("room") || "";
}


/* ================= LOGIN ================= */

function showLogin() {

  loginScreen.classList.remove("hidden");

  app.classList.add("hidden");
}


function showApp() {

  loginScreen.classList.add("hidden");

  app.classList.remove("hidden");
}


/* ================= CREATE ROOM ================= */

async function createRoom() {

  loginError.textContent = "";

  try {

    const response =
      await fetch(
        "/api/rooms",
        {
          method: "POST"
        }
      );

    const data =
      await response.json();

    roomInput.value =
      data.roomId;

  }

  catch (error) {

    loginError.textContent =
      "Could not create room. Is the server running?";

  }
}


/* ================= VALIDATE LOGIN ================= */

function validateLogin() {

  username =
    nameInput.value.trim();

  if (!username) {

    loginError.textContent =
      "Please enter your name.";

    return false;
  }

  roomId =
    roomInput.value.trim();

  if (!roomId) {

    loginError.textContent =
      "Create a room or enter a Room ID.";

    return false;
  }

  return true;
}


/* ================= JOIN ROOM ================= */

function joinRoom() {

  if (!validateLogin()) {
    return;
  }

  localStorage.setItem(
    "collabName",
    username
  );

  localStorage.setItem(
    "collabRoom",
    roomId
  );

  socket.connect();
}


/* ================= RENDER USERS ================= */

function renderUsers(users) {

  currentUsers =
    users || [];

  userCount.textContent =
    currentUsers.length;

  usersList.innerHTML = "";


  currentUsers.forEach(user => {

    const row =
      document.createElement("div");

    row.className = "user";


    const avatar =
      document.createElement("div");

    avatar.className = "avatar";

    avatar.style.background =
      user.color || "#4f46e5";

    avatar.textContent =
      user.name
        .charAt(0)
        .toUpperCase();


    const info =
      document.createElement("div");

    info.className =
      "user-name";

    info.textContent =
      user.name;


    if (user.id === selfId) {

      const you =
        document.createElement("span");

      you.className = "you";

      you.textContent =
        " (you)";

      info.appendChild(you);
    }


    row.appendChild(avatar);

    row.appendChild(info);

    usersList.appendChild(row);

  });
}


/* ================= LINE NUMBERS ================= */

function updateLineNumbers() {

  const lines =
    editor.value.split("\n").length;

  lineNumbers.textContent =
    Array.from(
      {
        length: lines
      },
      (_, i) => i + 1
    ).join("\n");
}


/* ================= EDITOR SCROLL ================= */

function syncScroll() {

  lineNumbers.scrollTop =
    editor.scrollTop;
}


/* ================= SET EDITOR CONTENT ================= */

function setEditorContent(content) {

  suppressChange = true;

  editor.value =
    content || "";

  suppressChange = false;

  updateLineNumbers();

  saveStatus.textContent =
    "All changes synced";
}


/* ================= SEND DOCUMENT CHANGE ================= */

function emitDocumentChange() {

  if (
    suppressChange ||
    !roomId
  ) {
    return;
  }

  localVersion += 1;

  saveStatus.textContent =
    "Syncing...";


  socket.emit(
    "document-change",
    {
      roomId: roomId,

      content:
        editor.value,

      version:
        localVersion
    }
  );


  clearTimeout(
    window.syncStatusTimer
  );


  window.syncStatusTimer =
    setTimeout(() => {

      saveStatus.textContent =
        "All changes synced";

    }, 300);
}


/* ================= TYPING ================= */

function updateTyping() {

  if (!roomId) {
    return;
  }


  socket.emit(
    "typing",
    {
      roomId: roomId,

      isTyping: true
    }
  );


  clearTimeout(
    typingTimer
  );


  typingTimer =
    setTimeout(() => {

      socket.emit(
        "typing",
        {
          roomId: roomId,

          isTyping: false
        }
      );

    }, 900);
}


/* ================= RENDER TYPING ================= */

function renderTyping() {

  const names = [];


  typingUsers.forEach(id => {

    const user =
      currentUsers.find(
        u => u.id === id
      );

    if (user) {
      names.push(user.name);
    }

  });


  if (!names.length) {

    typingText.textContent = "";

  }

  else if (names.length === 1) {

    typingText.textContent =
      `${names[0]} is typing...`;

  }

  else {

    typingText.textContent =
      `${names.slice(0, 2).join(", ")} are typing...`;

  }
}


/* ================= FILE NAME ================= */

const languageExtensions = {

  javascript: "js",

  python: "py",

  java: "java",

  cpp: "cpp",

  html: "html",

  css: "css",

  plaintext: "txt"

};


function updateFileName() {

  const ext =
    languageExtensions[
      languageSelect.value
    ] || "txt";


  if (
    languageSelect.value ===
    "plaintext"
  ) {

    fileName.textContent =
      "notes.txt";

  }

  else {

    fileName.textContent =
      `collaboration.${ext}`;

  }
}


/* ================= CHAT ================= */

function addChatMessage(data) {

  const wrapper =
    document.createElement("div");

  wrapper.className =
    "message";


  const meta =
    document.createElement("div");

  meta.className =
    "message-meta";


  const name =
    document.createElement("span");

  name.className =
    "message-name";

  name.textContent =
    data.name;


  const time =
    document.createElement("span");

  time.className =
    "message-time";

  time.textContent =
    new Date(
      data.timestamp
    ).toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    );


  const body =
    document.createElement("div");

  body.className =
    "message-body";

  body.textContent =
    data.message;


  meta.appendChild(name);

  meta.appendChild(time);

  wrapper.appendChild(meta);

  wrapper.appendChild(body);

  messages.appendChild(wrapper);


  messages.scrollTop =
    messages.scrollHeight;


  chatCount.textContent =
    messages.children.length;
}


/* ================= DOWNLOAD ================= */

function downloadFile() {

  const ext =
    languageExtensions[
      languageSelect.value
    ] || "txt";


  const filename =
    languageSelect.value ===
    "plaintext"

      ? "notes.txt"

      : `collaboration.${ext}`;


  const blob =
    new Blob(
      [editor.value],
      {
        type:
          "text/plain;charset=utf-8"
      }
    );


  const url =
    URL.createObjectURL(blob);


  const link =
    document.createElement("a");

  link.href = url;

  link.download =
    filename;

  link.click();


  URL.revokeObjectURL(url);
}


/* ================= COPY INVITE LINK ================= */

async function copyInviteLink() {

  const link =
    `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;


  try {

    await navigator.clipboard.writeText(
      link
    );

    copyLinkBtn.textContent =
      "Copied!";


    setTimeout(() => {

      copyLinkBtn.textContent =
        "Copy Invite Link";

    }, 1500);

  }

  catch {

    window.prompt(
      "Copy this invite link:",
      link
    );

  }
}


/* ================= LOGIN EVENTS ================= */

createRoomBtn.addEventListener(
  "click",
  createRoom
);


joinBtn.addEventListener(
  "click",
  joinRoom
);


[
  nameInput,
  roomInput
].forEach(input => {

  input.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Enter"
      ) {

        joinRoom();

      }

    }
  );

});


/* ================= EDITOR EVENTS ================= */

editor.addEventListener(
  "input",
  () => {

    updateLineNumbers();

    emitDocumentChange();

    updateTyping();

  }
);


editor.addEventListener(
  "scroll",
  syncScroll
);


editor.addEventListener(
  "keydown",
  event => {

    /*
      Make Tab insert spaces
      instead of leaving editor.
    */

    if (
      event.key === "Tab"
    ) {

      event.preventDefault();


      const start =
        editor.selectionStart;

      const end =
        editor.selectionEnd;


      editor.value =
        editor.value.substring(
          0,
          start
        )

        + "  "

        + editor.value.substring(
          end
        );


      editor.selectionStart =
        editor.selectionEnd =
          start + 2;


      updateLineNumbers();

      emitDocumentChange();

    }

  }
);


/* ================= LANGUAGE CHANGE ================= */

languageSelect.addEventListener(
  "change",
  () => {

    updateFileName();


    socket.emit(
      "language-change",
      {
        roomId:
          roomId,

        language:
          languageSelect.value
      }
    );

  }
);


/* ================= CLEAR ================= */

clearBtn.addEventListener(
  "click",
  () => {

    const confirmed =
      confirm(
        "Clear the shared document for everyone?"
      );


    if (!confirmed) {
      return;
    }


    socket.emit(
      "clear-document",
      {
        roomId:
          roomId
      }
    );

  }
);


/* ================= BUTTONS ================= */

downloadBtn.addEventListener(
  "click",
  downloadFile
);


copyLinkBtn.addEventListener(
  "click",
  copyInviteLink
);


leaveBtn.addEventListener(
  "click",
  () => {

    socket.disconnect();

    showLogin();

  }
);


/* ================= CHAT FORM ================= */

chatForm.addEventListener(
  "submit",
  event => {

    event.preventDefault();


    const message =
      chatInput.value.trim();


    if (!message) {
      return;
    }


    socket.emit(
      "chat-message",
      {
        roomId:
          roomId,

        message:
          message
      }
    );


    chatInput.value = "";

  }
);


/* ================= SOCKET CONNECT ================= */

socket.on(
  "connect",
  () => {

    selfId =
      socket.id;

    setConnectionStatus(
      true
    );


    socket.emit(
      "join-room",
      {
        roomId:
          roomId,

        name:
          username
      }
    );

  }
);


/* ================= SOCKET DISCONNECT ================= */

socket.on(
  "disconnect",
  () => {

    setConnectionStatus(
      false
    );

    saveStatus.textContent =
      "Disconnected";

  }
);


/* ================= CONNECTION ERROR ================= */

socket.on(
  "connect_error",
  () => {

    setConnectionStatus(
      false
    );

    loginError.textContent =
      "Unable to connect to the collaboration server.";

  }
);


/* ================= ROOM STATE ================= */

socket.on(
  "room-state",
  state => {

    showApp();


    roomLabel.textContent =
      `Room: ${roomId}`;


    roomIdDisplay.textContent =
      roomId;


    setEditorContent(
      state.document
    );


    languageSelect.value =
      state.language ||
      "javascript";


    updateFileName();


    renderUsers(
      state.users || []
    );


    renderTyping();

  }
);


/* ================= USER LIST ================= */

socket.on(
  "users-updated",
  users => {

    renderUsers(
      users
    );

    renderTyping();

  }
);


/* ================= USER JOINED ================= */

socket.on(
  "user-joined",
  data => {

    renderUsers(
      data.users || []
    );

    renderTyping();

  }
);


/* ================= USER LEFT ================= */

socket.on(
  "user-left",
  data => {

    typingUsers.delete(
      data.userId
    );


    renderUsers(
      data.users || []
    );


    renderTyping();

  }
);


/* ================= DOCUMENT CHANGE ================= */

socket.on(
  "document-change",
  data => {

    /*
      The server sends document changes
      to all other clients.

      Therefore the sender doesn't
      receive its own edit twice.
    */

    setEditorContent(
      data.content
    );

  }
);


/* ================= LANGUAGE CHANGE ================= */

socket.on(
  "language-change",
  language => {

    languageSelect.value =
      language;

    updateFileName();

  }
);


/* ================= TYPING EVENT ================= */

socket.on(
  "typing",
  data => {

    if (data.isTyping) {

      typingUsers.add(
        data.userId
      );

    }

    else {

      typingUsers.delete(
        data.userId
      );

    }


    renderTyping();

  }
);


/* ================= CHAT MESSAGE ================= */

socket.on(
  "chat-message",
  data => {

    addChatMessage(
      data
    );

  }
);


/* ================= RESTORE DATA ================= */

nameInput.value =
  localStorage.getItem(
    "collabName"
  ) || "";


roomInput.value =
  getRoomFromUrl()

  ||

  localStorage.getItem(
    "collabRoom"
  )

  || "";


if (
  roomInput.value &&
  nameInput.value
) {

  loginError.textContent =
    "Room link detected. Click Join Room to enter.";

}


updateLineNumbers();