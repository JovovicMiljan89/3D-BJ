// The accent comes from site.json (Izgled sajta) and can change in the CMS, so
// tests read it from the page instead of hard-coding one color.
export async function themeColor(page, cssVar) {
  return page.evaluate((v) => {
    const probe = document.createElement("div");
    probe.style.color = `var(${v})`;
    document.body.append(probe);
    const rgb = getComputedStyle(probe).color;
    probe.remove();
    return rgb;
  }, cssVar);
}
