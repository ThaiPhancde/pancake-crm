import { expect, test } from "bun:test";
import { messageText } from "../src/message-text";

test("renders Pancake HTML as text with line breaks and decoded entities", () => {
	expect(
		messageText(
			'<div>Hi &amp; welcome<br key="n_0"/>Gold &#128142;</div><div>Start</div>',
		),
	).toBe("Hi & welcome\nGold 💎\nStart");
	expect(messageText("<div></div>")).toBe("");
});

test("discards executable markup and preserves literal customer text", () => {
	expect(
		messageText(
			"<script>alert(1)</script><div>Hello <img src=x onerror=alert(1)>there</div>",
		),
	).toBe("Hello there");
	expect(messageText("Price < 10 & quantity > 2\nThank you")).toBe(
		"Price < 10 & quantity > 2\nThank you",
	);
	expect(messageText("&lt;script&gt;literal&lt;/script&gt;")).toBe(
		"<script>literal</script>",
	);
	expect(messageText("&#99999999;")).toBe("\uFFFD");
});
