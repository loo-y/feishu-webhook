import { Hono } from "hono";
import normal from './feishu/webhook/normal'
import {requestSendMessage} from './feishu/webhook/normal'
// import eventDispatcher from './feishu/webhook/event'
const app = new Hono<{ Bindings: Env }>();
// import * as lark from '@larksuiteoapi/node-sdk';

app.get("/api/", (c) => c.json({ name: "Cloudflare" }));
export default app;

app.post('/feishu/webhook/event', normal);
app.post('/feishu/send_message', requestSendMessage);
// 增加一个中间件用来处理飞书 webhook/event
// server.on('request', lark.adaptDefault('/webhook/event', eventDispatcher, {
//     autoChallenge:true,
// }));

// app.get('/feishu', lark.adaptDefault('/webhook/event', eventDispatcher, {
//     autoChallenge:true,
// }));
