import { FastifyInstance } from "fastify";
import crypto from "crypto";

/**
 * Register an ETag hook that adds conditional GET support.
 * On GET 200 responses, computes an MD5 hash of the body and sets the ETag header.
 * If the client sends If-None-Match matching the ETag, returns 304 Not Modified.
 */
export function registerEtag(app: FastifyInstance) {
  app.addHook("onSend", (request, reply, payload, done) => {
    // Only apply to GET requests with 200 status
    if (request.method !== "GET" || reply.statusCode !== 200) {
      done(null, payload);
      return;
    }

    // Need a string or buffer body to hash
    const body = typeof payload === "string" ? payload : null;
    if (!body) {
      done(null, payload);
      return;
    }

    const hash = crypto.createHash("md5").update(body).digest("hex");
    const etag = `"${hash}"`;

    reply.header("ETag", etag);

    // Check If-None-Match
    const ifNoneMatch = request.headers["if-none-match"];
    if (ifNoneMatch === etag) {
      reply.code(304);
      done(null, "");
      return;
    }

    done(null, payload);
  });
}
