import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
const require = createRequire(import.meta.url);
const React = require("react");
const babel = require("next/dist/compiled/babel/core");
const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const protocol = await import(`data:text/javascript;base64,${Buffer.from(read("lib/landing-experience.js")).toString("base64")}`);

test("Only the eight approved experience features are accepted", () => {
  assert.equal(protocol.EXPERIENCE_TEMPLATE_KEY, "cherry-blossom-day");
  assert.equal(protocol.EXPERIENCE_FEATURES.length, 8);
  for (const [key] of protocol.EXPERIENCE_FEATURES) assert.equal(protocol.isExperienceFeature(key), true);
  for (const value of ["submit", "delete", "https://example.com", null, {}, "__proto__"]) assert.equal(protocol.isExperienceFeature(value), false);
});

test("Landing HERO and all six Section 1 features remain byte-for-byte unchanged", () => {
  const original = execFileSync("git", ["show", "HEAD:app/page.js"], { encoding: "utf8" });
  const current = read("app/page.js");
  const section = source => source.slice(source.indexOf('    <section className={`landing-hero'), source.indexOf('    </section>', source.indexOf('id="benefits"')) + '    </section>'.length).replace(/\r\n/g, "\n");
  assert.ok(section(original).length > 1000);
  assert.equal(section(current), section(original));
  assert.ok(!current.includes('className="dd-detail-card"'));
});

// Execute the actual form handlers with stubbed React hooks and a fetch that
// fails the test on any network access. No real Event or database is involved.
function previewForm(file, overrides = {}) {
  let index = 0;
  const effects = [];
  let requests = 0;
  const hooks = {
    useState: initial => [Object.hasOwn(overrides, index) ? overrides[index++] : (index++, typeof initial === "function" ? initial() : initial), () => {}],
    useCallback: callback => callback,
    useEffect: effect => effects.push(effect),
  };
  const compiled = babel.transformSync(read(file), {
    presets: [[require("next/dist/compiled/babel/preset-react"), { runtime: "classic" }]],
    plugins: [require("next/dist/compiled/babel/plugin-transform-modules-commonjs")],
  }).code;
  const exports = {};
  const load = name => name === "react" ? hooks : name.endsWith("rsvp-fields")
    ? { __esModule: true, default: () => null, EMPTY_RSVP: {}, validateRsvp: () => "" }
    : { writeToClipboard: () => { throw Error("Unexpected clipboard access"); } };
  new Function("React", "exports", "require", "fetch", "window", compiled)(React, exports, load,
    () => { requests++; throw Error("Preview attempted a real request"); }, { location: { search: "" } });
  const tree = exports.default({ slug: "", preview: true });
  for (const effect of effects) effect();
  const find = (node, predicate) => {
    if (!node || typeof node !== "object") return null;
    if (predicate(node)) return node;
    for (const child of React.Children.toArray(node.props?.children)) { const found = find(child, predicate); if (found) return found; }
    return null;
  };
  return { find: predicate => find(tree, predicate), requests: () => requests };
}

test("RSVP preview cannot restore customer data or submit", async () => {
  const form = previewForm("app/invite/[slug]/rsvp-form.js", { 4: false });
  await form.find(node => node.type === "form").props.onSubmit({ preventDefault() {} });
  assert.equal(form.find(node => node.type === "button" && node.props.type === "submit").props.disabled, true);
  assert.equal(form.requests(), 0);
});

test("Guestbook preview blocks load, registration and deletion even with a deletion target", async () => {
  const form = previewForm("app/invite/[slug]/guestbook.js", { 4: { id: "mock-only" } });
  await form.find(node => node.type === "form").props.onSubmit({ preventDefault() {} });
  const popup = form.find(node => node.props?.role === "dialog");
  const footer = React.Children.toArray(popup.props.children.props.children).find(node => node.type === "footer");
  await React.Children.toArray(footer.props.children).at(-1).props.onClick();
  assert.equal(form.requests(), 0);
});
