// Validates content/site.json before it's allowed to reach a build.
// A broken edit by the admin should fail the Cloudflare build, not publish
// a broken site — so this is intentionally strict about required fields,
// types, and every image path actually existing on disk. Fields that are
// allowed to be empty (and hidden at render time — see build.mjs) are
// deliberately NOT in the required lists below.
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

export const SERVICE_ICONS = ["gear", "wrench", "gift", "layers", "shield", "scan"];

const REQUIRED_STRINGS = [
  "meta.title",
  "meta.description",
  "meta.lang",
  "seo.siteUrl",
  "seo.ogImage",
  "brand.name",
  "brand.logo",
  "brand.favicon",
  "brand.touchIcon",
  "brand.ownerName",
  "brand.ownerRole",
  "nav.servicesLabel",
  "nav.galleryLabel",
  "nav.pricesLabel",
  "nav.workshopLabel",
  "nav.faqLabel",
  "nav.contactLabel",
  "hero.eyebrow",
  "hero.headline",
  "hero.lead",
  "hero.primaryButton",
  "hero.secondaryButton",
  "hero.image",
  "hero.imageAlt",
  "servicesSection.heading",
  "gallerySection.heading",
  "gallerySection.subheading",
  "howSection.heading",
  "howSection.buttonLabel",
  "workshop.heading",
  "workshop.subheading",
  "workshop.photo",
  "workshop.photoAlt",
  "workshop.photoCaption",
  "maker.name",
  "maker.roleTag",
  "maker.bio",
  "maker.avatar",
  "maker.buttonLabel",
  "faqSection.heading",
  "contact.sectionHeading",
  "contact.sectionSubheading",
  "contact.web3formsKey",
  "contact.channelLabels.phone",
  "contact.channelLabels.viber",
  "contact.channelLabels.whatsapp",
  "contact.channelLabels.email",
  "contact.channelLabels.instagram",
  "contact.channelLabels.city",
  "contact.channelLabels.hoursHeading",
  "contact.channelLabels.copyButton",
  "contact.channelLabels.copiedLabel",
  "contact.fieldLabels.name",
  "contact.fieldLabels.email",
  "contact.fieldLabels.material",
  "contact.fieldLabels.service",
  "contact.fieldLabels.message",
  "contact.fieldLabels.fileLink",
  "contact.namePlaceholder",
  "contact.emailPlaceholder",
  "contact.messagePlaceholder",
  "contact.fileLinkPlaceholder",
  "contact.submitLabel",
  "contact.sendingLabel",
  "contact.errorMessage",
  "contact.networkErrorMessage",
  "contact.successMessage",
  "bottomBar.callLabel",
  "bottomBar.viberLabel",
  "bottomBar.inquiryLabel",
  "footer.tagline",
  "footer.kontaktHeading",
  "footer.hoursHeading",
  "footer.socialHeading",
  "footer.pibLabel",
  "footer.rightsText",
  "prices.heading",
  "prices.note",
];

// path -> required string sub-fields for each item in that array
const REQUIRED_ARRAY_ITEM_FIELDS = {
  trust: null, // array of plain strings, handled by REQUIRED_STRING_ARRAYS
  services: ["icon", "title", "text"],
  gallery: ["image", "alt", "caption"],
  steps: ["title", "text"],
  "workshop.equipment": ["image", "imageAlt", "tag", "title"],
  "workshop.stats": ["value", "label"],
  "prices.items": ["title", "hint"], // "from"/"featured" checked separately (not strings)
  faq: ["q", "a"],
  "contact.hours": ["days", "time"],
};

const REQUIRED_STRING_ARRAYS = ["trust", "contact.materialOptions", "contact.serviceOptions"];

// image fields to check for existence on disk (single value)
const IMAGE_FIELDS = ["brand.logo", "brand.favicon", "brand.touchIcon", "hero.image", "workshop.photo", "maker.avatar", "seo.ogImage"];

// [arrayPath, fieldNameInEachItem] to check for existence on disk
const IMAGE_ARRAY_FIELDS = [
  ["gallery", "image"],
  ["workshop.equipment", "image"],
];

// Optional image fields: only checked for existence IF non-empty (not required to be set at all).
const OPTIONAL_IMAGE_FIELDS = ["maker.photo"];

// At least one of these must be a non-empty string — a site with zero contact
// methods is a broken site, but which channel(s) are filled is up to the admin.
const AT_LEAST_ONE_CONTACT_METHOD = ["contact.phoneTel", "contact.viber", "contact.whatsapp", "contact.email"];

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
    if (!itemFields) continue;
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

  // services[].icon must be a known sprite icon key.
  const services = get(content, "services");
  if (isArray(services)) {
    services.forEach((item, i) => {
      if (isNonEmptyString(item?.icon) && !SERVICE_ICONS.includes(item.icon)) {
        errors.push(`"services[${i}].icon" is "${item.icon}" — must be one of: ${SERVICE_ICONS.join(", ")}`);
      }
    });
  }

  // prices.items[].from must be a number (>= 0); featured must be a boolean.
  const priceItems = get(content, "prices.items");
  if (isArray(priceItems)) {
    priceItems.forEach((item, i) => {
      if (typeof item?.from !== "number" || Number.isNaN(item.from) || item.from < 0) {
        errors.push(`"prices.items[${i}].from" must be a number >= 0 (use 0 to hide this card until a real price is set).`);
      }
      if (typeof item?.featured !== "boolean") {
        errors.push(`"prices.items[${i}].featured" must be true or false.`);
      }
    });
  } else {
    errors.push('Missing or empty required list: "prices.items"');
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

  for (const fieldPath of OPTIONAL_IMAGE_FIELDS) {
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

  const hasContactMethod = AT_LEAST_ONE_CONTACT_METHOD.some((fieldPath) => isNonEmptyString(get(content, fieldPath)));
  if (!hasContactMethod) {
    errors.push(
      `At least one contact method is required — fill in one of: ${AT_LEAST_ONE_CONTACT_METHOD.join(", ")}`
    );
  }

  return { valid: errors.length === 0, errors };
}
