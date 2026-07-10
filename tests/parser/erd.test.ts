import { describe, it, expect } from "vitest";
import { parse } from "../../src/parser/index.js";

describe("ERD parser", () => {
  it("detects erDiagram header", () => {
    const { ast } = parse("erDiagram\n  CUSTOMER ||--o{ ORDER : places");
    expect(ast.type).toBe("erd");
  });

  it("parses a basic relationship", () => {
    const { ast, warnings } = parse(`erDiagram
  CUSTOMER ||--o{ ORDER : places`);
    expect(ast.type).toBe("erd");
    if (ast.type !== "erd") return;
    expect(warnings).toHaveLength(0);
    expect(ast.entities).toHaveLength(2);
    expect(ast.relationships).toHaveLength(1);
    const rel = ast.relationships[0]!;
    expect(rel.from).toBe("CUSTOMER");
    expect(rel.to).toBe("ORDER");
    expect(rel.label).toBe("places");
    expect(rel.fromCardinality).toBe("exactly-one");
    expect(rel.toCardinality).toBe("zero-or-many");
    expect(rel.identifying).toBe(true);
  });

  it("parses all four cardinalities", () => {
    const { ast } = parse(`erDiagram
  A ||--|| B : one
  C |o--o| D : zeroone
  E }|--|{ F : onemany
  G }o--o{ H : zeromany`);
    if (ast.type !== "erd") throw new Error("not erd");
    const rels = ast.relationships;
    expect(rels[0]!.fromCardinality).toBe("exactly-one");
    expect(rels[0]!.toCardinality).toBe("exactly-one");
    expect(rels[1]!.fromCardinality).toBe("zero-or-one");
    expect(rels[1]!.toCardinality).toBe("zero-or-one");
    expect(rels[2]!.fromCardinality).toBe("one-or-many");
    expect(rels[2]!.toCardinality).toBe("one-or-many");
    expect(rels[3]!.fromCardinality).toBe("zero-or-many");
    expect(rels[3]!.toCardinality).toBe("zero-or-many");
  });

  it("distinguishes identifying vs non-identifying relationships", () => {
    const { ast } = parse(`erDiagram
  A ||--|| B : identifying
  C ||..|| D : nonidentifying`);
    if (ast.type !== "erd") throw new Error("not erd");
    expect(ast.relationships[0]!.identifying).toBe(true);
    expect(ast.relationships[1]!.identifying).toBe(false);
  });

  it("parses entity attributes", () => {
    const { ast, warnings } = parse(`erDiagram
  CUSTOMER {
    int id PK
    string name
    string email FK "customer email"
  }`);
    expect(warnings).toHaveLength(0);
    if (ast.type !== "erd") throw new Error("not erd");
    const entity = ast.entities.find((e) => e.id === "CUSTOMER")!;
    expect(entity.attributes).toHaveLength(3);
    expect(entity.attributes[0]).toMatchObject({ type: "int", name: "id", key: "PK" });
    expect(entity.attributes[1]).toMatchObject({ type: "string", name: "name" });
    expect(entity.attributes[1]!.key).toBeUndefined();
    expect(entity.attributes[2]).toMatchObject({ type: "string", name: "email", key: "FK", comment: "customer email" });
  });

  it("implicitly creates entities referenced in relationships", () => {
    const { ast } = parse(`erDiagram
  ORDER ||--|{ LINE-ITEM : contains`);
    if (ast.type !== "erd") throw new Error("not erd");
    expect(ast.entities.map((e) => e.id).sort()).toEqual(["LINE-ITEM", "ORDER"]);
  });

  it("merges implicit entity with later attribute block", () => {
    const { ast } = parse(`erDiagram
  CUSTOMER ||--o{ ORDER : places
  CUSTOMER {
    int id PK
  }`);
    if (ast.type !== "erd") throw new Error("not erd");
    const customer = ast.entities.find((e) => e.id === "CUSTOMER")!;
    expect(customer.attributes).toHaveLength(1);
  });

  it("ignores %% comment lines", () => {
    const { ast, warnings } = parse(`erDiagram
  %% this is a comment
  CUSTOMER ||--o{ ORDER : places`);
    if (ast.type !== "erd") throw new Error("not erd");
    expect(warnings).toHaveLength(0);
    expect(ast.relationships).toHaveLength(1);
  });

  it("strips surrounding quotes from relationship labels", () => {
    const { ast } = parse(`erDiagram
  A ||--|| B : "has many"`);
    if (ast.type !== "erd") throw new Error("not erd");
    expect(ast.relationships[0]!.label).toBe("has many");
  });

  it("erDiagram is no longer reported as unsupported", () => {
    const { ast } = parse("erDiagram\nA ||--|| B : test");
    expect(ast.type).not.toBe("unsupported");
  });

  it("returns zero entities and a warning for totally unparseable input", () => {
    const { ast, warnings } = parse("erDiagram\n!!! not valid");
    if (ast.type !== "erd") throw new Error("not erd");
    expect(ast.entities).toHaveLength(0);
    expect(warnings.some((w) => w.severity === "error")).toBe(true);
  });
});
