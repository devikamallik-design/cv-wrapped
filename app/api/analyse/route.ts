import { NextResponse } from "next/server";
import { ModelError, extractFacts, rewriteBullet } from "@/lib/extract";
import { ParseError, parseCv } from "@/lib/parse";
import { sanitise } from "@/lib/sanitise";
import { EngineError, computeWrapped } from "@/lib/wrapped";

// Node runtime (the default). POST handlers are never cached; the no-store header below
// also stops any CDN or browser from reusing an old result.
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

function fail(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, code, message }, { status, headers: NO_STORE });
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("NO_FILE", "Choose a CV file to upload.");
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("NO_FILE", "Choose a CV file to upload.");

  try {
    const cv = await parseCv(file);
    const extraction = await extractFacts(cv.text);
    const report = sanitise(extraction, cv.text);
    const wrapped = computeWrapped(extraction, report.bullets, report);
    const rewrite = wrapped.plotTwist.target ? await rewriteBullet(wrapped.plotTwist.target.text) : null;

    return NextResponse.json(
      {
        ok: true,
        file: { name: cv.fileName, pages: cv.pages },
        wrapped,
        rewrite,
      },
      { headers: NO_STORE },
    );
  } catch (e) {
    if (e instanceof ParseError || e instanceof EngineError) return fail(e.code, e.message, 422);
    if (e instanceof ModelError) return fail(e.code, e.message, e.code === "NO_KEY" ? 500 : 502);
    console.error("analyse failed", e);
    return fail("UNKNOWN", "Something went wrong reading this CV. Try again.", 500);
  }
}

export function GET() {
  return fail("METHOD", "Upload a CV with POST.", 405);
}
