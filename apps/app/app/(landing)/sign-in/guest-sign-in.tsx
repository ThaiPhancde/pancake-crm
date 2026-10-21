"use client";

import { Button } from "@crm/ui/components/button";
import { useState } from "react";

export function GuestSignIn() {
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	async function enter() {
		setPending(true);
		setError(null);
		try {
			const response = await fetch("/api/auth/sign-in/guest", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "{}",
			});
			const result = await response.json();
			if (!response.ok)
				throw new Error(
					result.message ?? "Không thể vào CRM. Vui lòng thử lại.",
				);
			if (typeof result.url !== "string" || !/^\/[^/]+\/shop$/.test(result.url))
				throw new Error("Đường dẫn shop không hợp lệ.");
			window.location.assign(result.url);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Không thể vào CRM.");
			setPending(false);
		}
	}
	return (
		<div className="flex flex-col gap-3">
			<Button variant="outline" size="xl" disabled={pending} onClick={enter}>
				{pending ? "Đang vào CRM…" : "Continue as guest"}
			</Button>
			<p className="text-center text-sm text-muted-foreground">
				Vào CRM / Shop mà không cần tài khoản.
			</p>
			{error && (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}
		</div>
	);
}
