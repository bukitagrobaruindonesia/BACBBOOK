import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Table from "../Table";

interface TestData {
  id: string;
  name: string;
  age: number;
}

const columns = [
  { key: "name" as keyof TestData, header: "Name" },
  { key: "age" as keyof TestData, header: "Age" },
];

const data: TestData[] = [
  { id: "1", name: "John", age: 30 },
  { id: "2", name: "Jane", age: 25 },
];

describe("Table Component", () => {
  it("renders table with headers", () => {
    render(<Table columns={columns} data={data} keyExtractor={(row) => row.id} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Age")).toBeInTheDocument();
  });

  it("renders table rows with data", () => {
    render(<Table columns={columns} data={data} keyExtractor={(row) => row.id} />);
    expect(screen.getByText("John")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("Jane")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
  });

  it("renders empty state when no data", () => {
    render(<Table columns={columns} data={[]} keyExtractor={(row) => row.id} emptyMessage="No data" />);
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("renders with custom cell renderers", () => {
    const customColumns = [
      { key: "name" as keyof TestData, header: "Name", render: (row: TestData) => <strong>{row.name}</strong> },
    ];
    render(<Table columns={customColumns} data={[{ id: "1", name: "John", age: 30 }]} keyExtractor={(row) => row.id} />);
    expect(screen.getByText("John")).toHaveTagName("strong");
  });

  it("renders with onRowClick", () => {
    const handleClick = vi.fn();
    render(<Table columns={columns} data={data} keyExtractor={(row) => row.id} onRowClick={handleClick} />);
    const row = screen.getByText("John").closest("tr");
    if (row) fireEvent.click(row);
    expect(handleClick).toHaveBeenCalledWith(data[0]);
  });

  it("shows loading state", () => {
    render(<Table columns={columns} data={[]} keyExtractor={(row) => row.id} isLoading={true} />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders with column width", () => {
    const widthColumns = [
      { key: "name" as keyof TestData, header: "Name", width: "200px" },
    ];
    const { container } = render(<Table columns={widthColumns} data={[{ id: "1", name: "John", age: 30 }]} keyExtractor={(row) => row.id} />);
    const th = container.querySelector("th");
    expect(th).toHaveStyle("width: 200px");
  });

  it("renders default empty message", () => {
    render(<Table columns={columns} data={[]} keyExtractor={(row) => row.id} />);
    expect(screen.getByText("Tidak ada data")).toBeInTheDocument();
  });
});
