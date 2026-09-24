// Validates content/site.json before it's allowed to reach a build.
// A broken edit by the admin should fail the Cloudflare build, not publish
// a broken site — so this is intentionally strict about required fields,
// types, and every image path actually existing on disk.
"use strict";

import fs from "node:fs";
import path from "node:path";

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}
function isArray(v) {
  return Array.isArray(v);
}
function isObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function get(obj, dottedPath) {
  return dottedPath.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

const REQUIRED_STRINGS = [
  "meta.title",
  "meta.description",
  "meta.lang",
  "brand.name",
  "brand.logo",
  "brand.favicon",
  "brand.touchIcon",
  "brand.ownerName",
  "brand.ownerRole",
  "nav.servicesLabel",
  "nav.workshopLabel",
  "nav.galleryLabel",
  "nav.howLabel",
  "nav.contactLabel",
  "hero.eyebrow",
  "hero.headline",
  "hero.lead",
  "hero.primaryButton",
  "hero.secondaryButton",
  "hero.image",
  "hero.imageAlt",
  "servicesSection.heading",
  "workshop.heading",
  "workshop.subheading",
  "workshop.photo",
  "workshop.photoAlt",
  "workshop.photoCaption",
  "workshop.footnote",
  "maker.name",
  "maker.roleTag",
  "maker.bio",
  "maker.avatar",
  "maker.buttonLabel",
  "gallerySection.heading",
  "gallerySection.subheading",
  "howSection.heading",
  "howSection.buttonLabel",
  "contact.phoneDisplay",
  "contact.phoneTel",
  "contact.email",
  "contact.web3formsKey",
  "contact.modalTitle",
  "contact.modalSubtitle",
  "contact.phoneTileLabel",
  "contact.emailTileLabel",
  "contact.fieldLabels.name",
  "contact.fieldLabels.email",
  "contact.fieldLabels.material",
  "contact.fieldLabels.service",
  "contact.fieldLabels.message",
  "contact.namePlaceholder",
  "contact.emailPlaceholder",
  "contact.messagePlaceholder",
  "contact.submitLabel",
  "contact.sendingLabel",
  "contact.errorMessage",
  "contact.networkErrorMessage",
  "contact.successMessage",
  "footer.text",
];

// path -> required string sub-fields for each item in that array
const REQUIRED_ARRAY_ITEM_FIELDS = {
  services: ["icon", "title", "text"],
  gallery: ["image", "alt", "caption"],
  steps: ["title", "text"],
  "workshop.equipment": ["image", "imageAlt", "tag", "title"],
  "workshop.stats": ["value", "label"],
};

// arrays that must exist and be non-empty, but whose items are plain strings
const REQUIRED_STRING_ARRAYS = ["contact.materialOptions", "contact.serviceOptions"];

// image fields to check for existence on disk (single value)
const IMAGE_FIELDS = ["brand.logo", "brand.favicon", "brand.touchIcon", "hero.image", "workshop.photo", "maker.avatar"];

// [arrayPath, fieldNameInEachItem] to check for existence on disk
const IMAGE_ARRAY_FIELDS = [
  ["gallery", "image"],
  ["workshop.equipment", "image"],
];

function imageExists(projectRoot, imagePath) {
  if (!isNonEmptyString(imagePath)) return false;
  const relative = imagePath.replace(/^\//, "");
  return fs.existsSync(path.join(projectRoot, relative));
}

export function validateContent(content, projectRoot) {
  const errors = [];

  if (!isObject(content)) {
    return { valid: false, errors: ["content/site.json must contain a JSON object."] };
  }

  for (const fieldPath of REQUIRED_STRINGS) {
    const value = get(content, fieldPath);
    if (!isNonEmptyString(value)) {
      errors.push(`Missing or empty required text field: "${fieldPath}"`);
    }
  }

  for (const [arrayPath, itemFields] of Object.entries(REQUIRED_ARRAY_ITEM_FIELDS)) {
    const arr = get(content, arrayPath);
    if (!isArray(arr) || arr.length === 0) {
      errors.push(`Missing or empty required list: "${arrayPath}"`);
      continue;
    }
    arr.forEach((item, index) => {
      if (!isObject(item)) {
        errors.push(`"${arrayPath}[${index}]" must be an object.`);
        return;
      }
      for (const field of itemFields) {
        if (!isNonEmptyString(item[field])) {
          errors.push(`Missing or empty required field "${field}" in "${arrayPath}[${index}]"`);
        }
      }
    });
  }

  // Nested specs[] inside each workshop.equipment item.
  const equipment = get(content, "workshop.equipment");
  if (isArray(equipment)) {
    equipment.forEach((item, i) => {
      const specs = item?.specs;
      if (!isArray(specs) || specs.length === 0) {
        errors.push(`Missing or empty required list: "workshop.equipment[${i}].specs"`);
        return;
      }
      specs.forEach((spec, j) => {
        if (!isNonEmptyString(spec?.label) || !isNonEmptyString(spec?.value)) {
          errors.push(`"workshop.equipment[${i}].specs[${j}]" needs non-empty "label" and "value"`);
        }
      });
    });
  }

  for (const arrayPath of REQUIRED_STRING_ARRAYS) {
    const arr = get(content, arrayPath);
    if (!isArray(arr) || arr.length === 0) {
      errors.push(`Missing or empty required list: "${arrayPath}"`);
      continue;
    }
    arr.forEach((item, index) => {
      if (!isNonEmptyString(item)) {
        errors.push(`"${arrayPath}[${index}]" must be a non-empty string.`);
      }
    });
  }

  for (const fieldPath of IMAGE_FIELDS) {
    const value = get(content, fieldPath);
    if (isNonEmptyString(value) && !imageExists(projectRoot, value)) {
      errors.push(`Image not found on disk for "${fieldPath}": ${value}`);
    }
  }

  for (const [arrayPath, field] of IMAGE_ARRAY_FIELDS) {
    const arr = get(content, arrayPath);
    if (isArray(arr)) {
      arr.forEach((item, index) => {
        const value = item?.[field];
        if (isNonEmptyString(value) && !imageExists(projectRoot, value)) {
          errors.push(`Image not found on disk for "${arrayPath}[${index}].${field}": ${value}`);
        }
      });
    }
  }

  return { valid: errors.length === 0, errors };
}
