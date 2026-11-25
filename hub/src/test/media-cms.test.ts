import { describe, expect, it } from "vitest";
import { DEFAULT_LOGO_PATH, getMediaUrl } from "../lib/mediaCms";
import { SUPABASE_URL } from "../integrations/supabase/client";

describe("mediaCms utility", () => {
  it("exports DEFAULT_LOGO_PATH as /logo.svg", () => {
    expect(DEFAULT_LOGO_PATH).toBe("/logo.svg");
  });

  it("returns DEFAULT_LOGO_PATH when pathOrUrl is undefined or empty", () => {
    expect(getMediaUrl()).toBe(DEFAULT_LOGO_PATH);
    expect(getMediaUrl(undefined)).toBe(DEFAULT_LOGO_PATH);
    expect(getMediaUrl("")).toBe(DEFAULT_LOGO_PATH);
  });

  it("returns local public path directly when path starts with /", () => {
    expect(getMediaUrl("/logo.svg")).toBe("/logo.svg");
    expect(getMediaUrl("/images/custom.png")).toBe("/images/custom.png");
  });

  it("returns external URL directly when path starts with http:// or https://", () => {
    expect(getMediaUrl("https://example.com/logo.png")).toBe("https://example.com/logo.png");
    expect(getMediaUrl("http://example.com/logo.png")).toBe("http://example.com/logo.png");
    expect(getMediaUrl("data:image/svg+xml;utf8,...")).toBe("data:image/svg+xml;utf8,...");
    expect(getMediaUrl("blob:http://localhost/1234")).toBe("blob:http://localhost/1234");
  });

  it("constructs Supabase Storage URL when a bucket key is passed", () => {
    expect(getMediaUrl("media/logo.svg")).toBe(
      `${SUPABASE_URL}/storage/v1/object/public/media/logo.svg`
    );
    expect(getMediaUrl("brand-assets/hero.webp")).toBe(
      `${SUPABASE_URL}/storage/v1/object/public/brand-assets/hero.webp`
    );
  });

  it("cleans redundant storage/v1/object/public prefix if included in bucket key", () => {
    expect(getMediaUrl("storage/v1/object/public/media/logo.svg")).toBe(
      `${SUPABASE_URL}/storage/v1/object/public/media/logo.svg`
    );
  });
});
