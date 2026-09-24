// Tiny zero-dependency template engine.
// Supports: {{path.to.value}} (HTML-escaped), {{#each path}}...{{/each}} (with
// nesting), {{this}} inside an each over primitives, and {{@index}}/{{@index1}}
// for the nearest enclosing each loop's position.
"use strict";

import { escapeHtml } from "./escape.mjs";

function tokenize(template) {
  const tokens = [];
  const re = /{{\s*([^}]+?)\s*}}/g;
  let lastIndex = 0;
  let match;
  while ((match = re.exec(template))) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: template.slice(lastIndex, match.index) });
    }
    const expr = match[1].trim();
    if (expr.startsWith("#each ")) {
      tokens.push({ type: "each-open", path: expr.slice(6).trim() });
    } else if (expr === "/each") {
      tokens.push({ type: "each-close" });
    } else {
      tokens.push({ type: "var", path: expr });
    }
    lastIndex = re.lastIndex;
  }
  if (lastIndex < template.length) {
    tokens.push({ type: "text", value: template.slice(lastIndex) });
  }
  return tokens;
}

// Turns the flat token stream into a tree, so nested {{#each}} blocks
// (e.g. workshop.equipment[].specs[]) render correctly.
function parseNodes(tokens, start) {
  const nodes = [];
  let i = start;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.type === "each-close") {
      return { nodes, next: i + 1 };
    }
    if (t.type === "each-open") {
      const { nodes: children, next } = parseNodes(tokens, i + 1);
      nodes.push({ type: "each", path: t.path, children });
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

function renderNodes(nodes, scopeStack) {
  let out = "";
  for (const node of nodes) {
    if (node.type === "text") {
      out += node.value;
    } else if (node.type === "var") {
      const value = resolvePath(scopeStack, node.path);
      out += escapeHtml(value === undefined || value === null ? "" : value);
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
