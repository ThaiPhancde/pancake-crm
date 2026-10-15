import { expect, test } from "bun:test";
import { phoneTail } from "../src/phone";

test("phoneTail reads local and international forms as one number", () => {
	for (const phone of [
		"0553409828",
		"971553409828",
		"+971 55 340 9828",
		"00971553409828",
	])
		expect(phoneTail(phone, "971")).toBe("553409828");
	expect(phoneTail("12345", "971")).toBeNull();
	expect(phoneTail(null)).toBeNull();
});
