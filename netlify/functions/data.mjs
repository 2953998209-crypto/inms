import { getStore } from "@netlify/blobs";

/* 房间制云同步后端
 * GET  /api/data?room=xxx  -> 返回该房间的存储数据
 * PUT  /api/data?room=xxx  -> 存储/更新该房间的数据（body: {data: ...}）
 * POST /api/data?room=xxx  -> 同 PUT（兼容）
 * 每个房间 ID 对应独立的 blob key，互不干扰
 */

export default async (req, context) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate",
  };

  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: cors });
  }

  // 解析 room 参数
  const url = new URL(req.url);
  const room = url.searchParams.get("room") || "default";

  // 安全限制：room ID 长度限制
  if (room.length > 200) {
    return new Response(JSON.stringify({ ok: false, error: "room_id_too_long" }), {
      status: 400, headers: cors,
    });
  }

  let store;
  try {
    store = getStore({ name: "inms-rooms", consistency: "strong" });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: "blobs_unavailable", detail: String(e && e.message || e) }), {
      status: 503, headers: cors,
    });
  }

  // 以 room 为 key 隔离存储
  const blobKey = "room:" + room;

  try {
    if (req.method === "GET") {
      const v = await store.get(blobKey, { type: "json" });
      return new Response(JSON.stringify({ ok: true, data: v || null }), { headers: cors });
    }

    if (req.method === "PUT" || req.method === "POST") {
      const body = await req.json();
      const payload = body.data || body;
      const ts = Date.now();
      // 写入时附加服务端时间戳
      if (payload && typeof payload === "object") {
        payload._serverTs = ts;
      }
      await store.setJSON(blobKey, payload);
      return new Response(JSON.stringify({ ok: true, updatedAt: ts }), { headers: cors });
    }

    if (req.method === "DELETE") {
      await store.delete(blobKey);
      return new Response(JSON.stringify({ ok: true, deleted: room }), { headers: cors });
    }

    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405, headers: cors,
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e && e.message || e) }), {
      status: 500, headers: cors,
    });
  }
};

export const config = { path: "/api/data" };
