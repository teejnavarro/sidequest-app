import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "./proxy";

describe("proxy", () => {
  it("redirects to / when there is no session cookie", async () => {
    const res = await proxy(new NextRequest("http://localhost:3000/trips"));
    expect([307, 308]).toContain(res.status);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/");
  });

  it("passes through when the session cookie is present", async () => {
    const res = await proxy(
      new NextRequest("http://localhost:3000/profile", {
        headers: { cookie: "better-auth.session_token=made-up-token" },
      }),
    );
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("recognises the cookie name used on the live HTTPS site", async () => {
    const res = await proxy(
      new NextRequest("https://sidequest.example/trips", {
        headers: { cookie: "__Secure-better-auth.session_token=made-up-token" },
      }),
    );
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects nested pages and ignores unrelated cookies", async () => {
    const res = await proxy(
      new NextRequest("http://localhost:3000/trips/some-trip", {
        headers: { cookie: "other=made-up-value" },
      }),
    );
    expect(new URL(res.headers.get("location")!).pathname).toBe("/");
  });

  it("guards trips and profile but leaves the home page open", () => {
    expect(config.matcher).toEqual(["/trips/:path*", "/profile/:path*"]);
  });
});
