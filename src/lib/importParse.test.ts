import { describe, expect, it } from "vitest";
import { findByName, parseEmployees } from "./importParse";

describe("импорт сотрудников из вставленной таблицы", () => {
  it("TSV из WPS с заголовком и лишними колонками", () => {
    const text = [
      "№\tДОЛЖНОСТЬ\tСОТРУДНИК\t№ ПАСПОРТА\tВСЕГО",
      "1\tШеф\tVivian Hale\t100101\t478",
      "2\tЗаместитель Шефа\tMarcus Reed\t100102\t414",
      "3\tИнспектор\t\t\t",
    ].join("\n");
    const r = parseEmployees(text);
    expect(r.hasHeader).toBe(true);
    expect(r.rows).toEqual([
      { line: 2, name: "Vivian Hale", passport: "100101", dept: "", position: "Шеф" },
      { line: 3, name: "Marcus Reed", passport: "100102", dept: "", position: "Заместитель Шефа" },
    ]);
  });

  it("лист «Личный состав» из Google (Имя, Отдел, Должность, Ранг, Паспорт)", () => {
    const text = "Имя\tОтдел\tДолжность\tРанг\tПаспорт\nArthur Graves\tОфис\tНачальник тюрьмы\t13\t200201\n";
    const r = parseEmployees(text);
    expect(r.columns).toEqual(["name", "dept", "position", "skip", "passport"]);
    expect(r.rows[0]).toMatchObject({ name: "Arthur Graves", dept: "Офис", position: "Начальник тюрьмы", passport: "200201" });
  });

  it("без заголовка: угадываем паспорт по цифрам и отдел по короткому тексту", () => {
    const text = "Mark Fisher\tIAD\tНачальник отдела\t200210\nLiam Price\tIAD\tЗаместитель начальника отдела\t123456";
    const r = parseEmployees(text);
    expect(r.hasHeader).toBe(false);
    expect(r.rows[1]).toMatchObject({ name: "Liam Price", dept: "IAD", position: "Заместитель начальника отдела", passport: "123456" });
  });

  it("CSV с кавычками и точкой с запятой", () => {
    const r = parseEmployees('Имя;Паспорт\n"Smith, John";"123 456"');
    expect(r.rows[0]).toMatchObject({ name: "Smith, John", passport: "123456" });
  });

  it("нестрогое сопоставление: кириллица «РВ» = латиница «PB», регистр, подчёркивания", () => {
    const depts = [{ name: "PB" }, { name: "Офис шефа" }];
    expect(findByName(depts, "РВ")?.name).toBe("PB");
    expect(findByName(depts, "офис  ШЕФА")?.name).toBe("Офис шефа");
    expect(findByName([{ name: "Rosa Mendez" }], "rosa_mendez")?.name).toBe("Rosa Mendez");
  });
});
