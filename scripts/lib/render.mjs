// Tiny zero-dependency template engine.
// Supports:
//   {{path.to.value}}     HTML-escaped interpolation
//   {{{path.to.value}}}   RAW (unescaped) interpolation — use only for values the
//                         build script itself computed and controls (e.g. a JSON-LD
//                         blob), never for arbitrary admin-entered text.
//   {{#each path}}...{{/each}}   loop, with nesting; {{this}} for primitive items;
//                                 {{@index}} / {{@index1}} for position.
//   {{#if path}}...{{/if}}       renders children only when the value is truthy
//                                 (non-empty string/array, non-zero number, not
//                                 false/null/undefined) — same scope, no new frame.
"use strict";

import { escapeHtml } from "./escape.mjs";

function tokenize(template) {
  const tokens = [];
  // Order matters: try the 3-brace / block forms before the plain 2-brace form.
  const re = /{{{\s*([^}]+?)\s*}}}|{{\s*([^}]+?)\s*}}/g;
  let lastIndex = 0;
  let match;
  while ((match = re.exec(template))) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: template.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      tokens.push({ type: "raw", path: match[1].trim() });
    } else {
      const expr = match[2].trim();
      if (expr.startsWith("#each ")) {
        tokens.push({ type: "each-open", path: expr.slice(6).trim() });
      } else if (expr === "/each") {
        tokens.push({ type: "each-close" });
      } else if (expr.startsWith("#if ")) {
        tokens.push({ type: "if-open", path: expr.slice(4).trim() });
      } else if (expr === "/if") {
        tokens.push({ type: "if-close" });
      } else {
        tokens.push({ type: "var", path: expr });
      }
    }
    lastIndex = re.lastIndex;
  }
  if (lastIndex < template.length) {
    tokens.push({ type: "text", value: template.slice(lastIndex) });
  }
  return tokens;
}

// Turns the flat token stream into a tree, so nested {{#each}}/{{#if}} blocks
// (e.g. workshop.equipment[].specs[], or an #if inside an #each item) render correctly.
function parseNodes(tokens, start) {
  const nodes = [];
  let i = start;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.type === "each-close" || t.type === "if-close") {
      return { nodes, next: i + 1 };
    }
    if (t.type === "each-open") {
      const { nodes: children, next } = parseNodes(tokens, i + 1);
      nodes.push({ type: "each", path: t.path, children });
      i = next;
      continue;
    }
    if (t.type === "if-open") {
      const { nodes: children, next } = parseNodes(tokens, i + 1);
      nodes.push({ type: "if", path: t.path, children });
      i = next;
      continue;
    }
    nodes.push(t);
    i += 1;
  }
  return { nodes, next: i };
}

function resolvePath(scopeStack, dottedPath) {
  if (dottedPath === "this") {
    return scopeStack[scopeStack.length - 1].value;
  }
  if (dottedPath === "@index" || dottedPath === "@index1") {
    for (let i = scopeStack.length - 1; i >= 0; i--) {
      if (scopeStack[i].index !== undefined) {
        return dottedPath === "@index1" ? scopeStack[i].index + 1 : scopeStack[i].index;
      }
    }
    return undefined;
  }

  const parts = dottedPath.split(".");
  // Mustache-style fallback: try the innermost scope first, then walk outward.
  for (let i = scopeStack.length - 1; i >= 0; i--) {
    let cur = scopeStack[i].value;
    let ok = true;
    for (const part of parts) {
      if (cur != null && typeof cur === "object" && part in cur) {
        cur = cur[part];
      } else {
        ok = false;
        break;
      }
    }
    if (ok) return cur;
  }
  return undefined;
}

function isTruthy(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return Boolean(value);
}

function renderNodes(nodes, scopeStack) {
  let out = "";
  for (const node of nodes) {
    if (node.type === "text") {
      out += node.value;
    } else if (node.type === "var") {
      const value = resolvePath(scopeStack, node.path);
      out += escapeHtml(value === undefined || value === null ? "" : value);
    } else if (node.type === "raw") {
      const value = resolvePath(scopeStack, node.path);
      out += value === undefined || value === null ? "" : String(value);
    } else if (node.type === "if") {
      const value = resolvePath(scopeStack, node.path);
      if (isTruthy(value)) out += renderNodes(node.children, scopeStack);
    } else if (node.type === "each") {
      const arr = resolvePath(scopeStack, node.path);
      if (Array.isArray(arr)) {
        arr.forEach((item, index) => {
          scopeStack.push({ value: item, index });
          out += renderNodes(node.children, scopeStack);
          scopeStack.pop();
        });
      }
    }
  }
  return out;
}

export function renderTemplate(template, data) {
  const tokens = tokenize(template);
  const { nodes } = parseNodes(tokens, 0);
  return renderNodes(nodes, [{ value: data, index: undefined }]);
}
