import { test, expect } from "@playwright/test";
import path from "node:path";
test("complete reference workflow uses real API data", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/"))
      expect(r.headers()["x-api-key"]).toBeUndefined();
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Workspace overview" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your next discovery starts here" }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/genomedesk-overview.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Import your first VCF" }).click();
  await page.getByRole("button", { name: "Use synthetic example" }).click();
  await expect(page.getByLabel("Sample name")).toHaveValue(
    "Synthetic reference sample",
  );
  await page
    .getByRole("button", { name: "Import sample", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Synthetic reference sample" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Variant explorer" }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await expect(
    page.getByRole("cell", { name: "A, G", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Unfiltered", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Unavailable", exact: true }),
  ).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Generate explanation" }),
  ).toBeDisabled();
  await page.mouse.move(0, 0);
  await page.screenshot({ path: "/tmp/genomedesk-sample.png", fullPage: true });
  await page.getByLabel("PASS only").check();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page
    .getByRole("combobox", { name: "Chromosome", exact: true })
    .selectOption("chr2");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByLabel("Minimum quality").fill("100");
  await expect(
    page.getByRole("heading", { name: "No records match these filters" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await page.reload();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await page
    .getByRole("button", { name: "Delete sample", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep sample" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Delete sample", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL("/samples");
  await expect(
    page.getByRole("heading", { name: "Your next discovery starts here" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("invalid assembly and invalid files show real errors", async ({
  page,
}) => {
  await page.goto("/upload");
  await page
    .getByLabel("VCF file", { exact: true })
    .setInputFiles({
      name: "bad.fastq",
      mimeType: "text/plain",
      buffer: Buffer.from("invalid"),
    });
  await expect(
    page.getByRole("alert", { name: "Request error" }),
  ).toContainText("uncompressed .vcf");
  await page
    .getByLabel("VCF file", { exact: true })
    .setInputFiles(path.resolve("../examples/synthetic.vcf"));
  await page.getByLabel("Reference assembly").selectOption("GRCh37");
  await page
    .getByRole("button", { name: "Import sample", exact: true })
    .click();
  await expect(
    page.getByRole("alert", { name: "Request error" }),
  ).toContainText("Invalid or unsupported VCF input");
  await page
    .getByLabel("VCF file", { exact: true })
    .setInputFiles({
      name: "bad.vcf",
      mimeType: "text/plain",
      buffer: Buffer.from("invalid"),
    });
  await page
    .getByRole("button", { name: "Import sample", exact: true })
    .click();
  await expect(
    page.getByRole("alert", { name: "Request error" }),
  ).toContainText("Invalid or unsupported VCF input");
});
test("mobile navigation and reference guide work without overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("link", { name: "Integration guide", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "One API. Your next frontend." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("proxy prevents unsupported paths and cross-origin deletion", async ({
  request,
}) => {
  const r = await request.get("/api/annotation");
  expect(r.status()).toBe(404);
  const d = await request.delete(
    "/api/samples/00000000-0000-0000-0000-000000000001",
    { headers: { Origin: "https://untrusted.example" } },
  );
  expect(d.status()).toBe(403);
});

test("pagination returns real records and resets when filters change", async ({
  page,
  request,
}) => {
  const text =
    '##fileformat=VCFv4.2\n##reference=GRCh38\n##contig=<ID=chr1>\n##INFO=<ID=DP,Number=1,Type=Integer,Description="Site depth">\n#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n' +
    Array.from(
      { length: 30 },
      (_, i) => `chr1\t${i + 1}\t.\tA\tG\t60\tPASS\t.\n`,
    ).join("");
  const r = await request.post("/api/samples", {
    multipart: {
      sample_name: "Pagination fixture",
      assembly: "GRCh38",
      file: {
        name: "pagination.vcf",
        mimeType: "text/plain",
        buffer: Buffer.from(text),
      },
    },
  });
  expect(r.status()).toBe(201);
  const sample = await r.json();
  try {
    await page.goto(`/samples/${sample.id}`);
    await expect(page.locator("tbody tr")).toHaveCount(25);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator("tbody tr")).toHaveCount(5);
    await expect(page.getByText("26–30 of 30 records")).toBeVisible();
    await page.getByLabel("PASS only").check();
    await expect(page.locator("tbody tr")).toHaveCount(25);
    await expect(page.getByText("1–25 of 30 records")).toBeVisible();
  } finally {
    await request.delete(`/api/samples/${sample.id}`);
  }
});
test("AI draft is escaped, review-labelled, and provider errors remain visible", async ({
  page,
  request,
}) => {
  const fs = await import("node:fs/promises");
  const r = await request.post("/api/samples", {
    multipart: {
      sample_name: "AI UI fixture",
      assembly: "GRCh38",
      file: {
        name: "synthetic.vcf",
        mimeType: "text/plain",
        buffer: await fs.readFile(path.resolve("../examples/synthetic.vcf")),
      },
    },
  });
  const sample = await r.json();
  expect(r.status()).toBe(201);
  await page.route("**/api/capabilities", async (route) => {
    const r = await route.fetch();
    await route.fulfill({ json: { ...(await r.json()), ai_configured: true } });
  });
  let calls = 0;
  await page.route(`**/api/samples/${sample.id}/explain`, (route) => {
    calls++;
    return calls === 1
      ? route.fulfill({
          json: {
            text: '<script>alert("unsafe")</script> Research draft.',
            model: "mock-ui-test-model",
            generated_at: new Date().toISOString(),
            review_required: true,
            source_metrics: sample.summary,
          },
        })
      : route.fulfill({
          status: 502,
          json: { detail: "AI provider unavailable; retry later" },
        });
  });
  try {
    await page.goto(`/samples/${sample.id}`);
    await page.getByRole("button", { name: "Generate explanation" }).click();
    await expect(
      page.getByText("AI draft · Researcher review required"),
    ).toBeVisible();
    await expect(page.locator(".explanation-text")).toContainText("<script>");
    await expect(page.locator(".explanation-text script")).toHaveCount(0);
    await page.getByText("View source metrics").click();
    await expect(page.locator(".source-metrics pre")).toContainText(
      "record_count",
    );
    await page.getByRole("button", { name: "Generate another draft" }).click();
    await expect(
      page.getByRole("alert", { name: "Request error" }),
    ).toContainText("AI provider unavailable");
  } finally {
    await request.delete(`/api/samples/${sample.id}`);
  }
});
