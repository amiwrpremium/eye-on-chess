// Stockfish Web Worker
// Loads the WASM engine and communicates via postMessage
// Note: worker.wasm must exist alongside this file (copy of stockfish.wasm)
// because Emscripten resolves the WASM filename from the script name.

let engine = null;

importScripts("/stockfish/stockfish.js");

Stockfish().then((sf) => {
  engine = sf;

  engine.addMessageListener((line) => {
    postMessage({ type: "uci", data: line });
  });

  postMessage({ type: "ready" });
});

// Handle messages from main thread
onmessage = function (e) {
  if (!engine) return;

  if (e.data.type === "cmd") {
    engine.postMessage(e.data.cmd);
  }
};
