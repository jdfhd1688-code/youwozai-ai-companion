// Local integration fixture only. Never imported by the application.
import http from "node:http";
const sampleRate = 16000, samples = sampleRate * 12;
const wav = Buffer.alloc(44 + samples * 2);
wav.write("RIFF", 0); wav.writeUInt32LE(36 + samples * 2, 4);
wav.write("WAVEfmt ", 8); wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write("data", 36); wav.writeUInt32LE(samples * 2, 40);
for (let i = 0; i < samples; i++) wav.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 220 / sampleRate) * 500), 44 + i * 2);
http.createServer((request, response) => {
  let body = "";
  request.on("data", (part) => { body += part; });
  request.on("end", () => {
    const params = JSON.parse(body || "{}");
    console.log(JSON.stringify({ voice: params.voice, speed: params.speed }));
    response.writeHead(200, { "Content-Type": "audio/wav" });
    response.end(wav);
  });
}).listen(3456, "127.0.0.1", () => console.log("Audio test fixture on 127.0.0.1:3456"));
