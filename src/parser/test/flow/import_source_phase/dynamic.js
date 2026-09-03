const x = import.source("module");
async function f() {
  return await import.source("module", { with: { type: "json" } });
}
