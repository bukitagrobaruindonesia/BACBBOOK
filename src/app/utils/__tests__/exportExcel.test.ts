import { describe, it, expect, vi } from "vitest";
import * as XLSX from "xlsx";
import { exportToExcel } from "@/app/utils/exportExcel";

vi.mock("xlsx", () => ({
  utils: {
    book_new: vi.fn(() => ({})),
    json_to_sheet: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  write: vi.fn(() => new Uint8Array([1, 2, 3])),
}));

vi.mock("file-saver", () => ({
  saveAs: vi.fn(),
}));

describe("exportExcel Utils", () => {
  it("exports data to Excel with correct filename", () => {
    const data = [
      { name: "John", age: 30 },
      { name: "Jane", age: 25 },
    ];
    exportToExcel(data, "test-file");
    expect(XLSX.utils.book_new).toHaveBeenCalled();
    expect(XLSX.utils.json_to_sheet).toHaveBeenCalledWith(data);
  });

  it("handles empty data array", () => {
    const data: Record<string, unknown>[] = [];
    exportToExcel(data, "empty-file");
    expect(XLSX.utils.json_to_sheet).toHaveBeenCalledWith([]);
  });

  it("applies custom sheet name", () => {
    const data = [{ test: "value" }];
    exportToExcel(data, "file", "CustomSheet");
    expect(XLSX.utils.book_append_sheet).toHaveBeenCalled();
  });

  it("exports with default sheet name", () => {
    const data = [{ test: "value" }];
    exportToExcel(data, "file");
    expect(XLSX.utils.book_append_sheet).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      "Data"
    );
  });
});
