"use client";

import Close from "@carbon/icons-react/es/Close";
import Settings from "@carbon/icons-react/es/Settings";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { Label } from "@crm/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Switch } from "@crm/ui/components/switch";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { SettingsLine, SettingsRow } from "@/components/shop/page";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { GENERAL_SETTINGS, UNSUPPORTED } from "./config";
import { Unsupported } from "./unsupported";

type ShopSettings = RouterOutputs["pancakeSettings"]["get"];
type Preferences = RouterOutputs["pancakeSettings"]["preferences"];
type SettingsPatch = Partial<
	Pick<
		ShopSettings,
		| "displayName"
		| "currency"
		| "timezone"
		| "countries"
		| "dialCode"
		| "showSamePhoneOnConversation"
		| "mergeOrdersByPhone"
		| "customerSources"
	>
>;
type PreferencesPatch = Partial<
	Pick<
		Preferences,
		"disableAppNotifications" | "browserNotifications" | "sound"
	>
>;
type Dialogs = "name" | "copy" | "sources" | "dialCode" | null;

export type SettingsOption = { value: string; label: string };

const SAVE_ERROR = "Không thể lưu cài đặt. Vui lòng thử lại.";

function ConfigButton({
	onClick,
	disabled,
	title,
}: {
	onClick: () => void;
	disabled: boolean;
	title?: string;
}) {
	return (
		<span
			className="inline-flex overflow-hidden rounded-md border"
			title={title}
		>
			<Button
				variant="ghost"
				size="sm"
				className="rounded-none text-primary"
				onClick={onClick}
				disabled={disabled}
			>
				Cấu hình
			</Button>
			<Button
				variant="ghost"
				size="icon-sm"
				className="rounded-none border-l text-primary"
				aria-label="Mở cấu hình"
				onClick={onClick}
				disabled={disabled}
			>
				<Icon icon={Settings} />
			</Button>
		</span>
	);
}

function OptionSelect({
	label,
	value,
	options,
	onChange,
	disabled,
	placeholder,
}: {
	label: string;
	value: string;
	options: SettingsOption[];
	onChange: (value: string) => void;
	disabled: boolean;
	placeholder?: string;
}) {
	return (
		<Select value={value} onValueChange={onChange} disabled={disabled}>
			<SelectTrigger aria-label={label} className="min-w-40">
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			<SelectContent>
				{options.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

export function GeneralSettings({
	shopId,
	shopName,
	initialSettings,
	initialPreferences,
	shops,
	currencies,
	timezones,
	countries,
	sounds,
}: {
	shopId: string;
	shopName: string;
	initialSettings: ShopSettings;
	initialPreferences: Preferences;
	shops: SettingsOption[];
	currencies: SettingsOption[];
	timezones: SettingsOption[];
	countries: SettingsOption[];
	sounds: SettingsOption[];
}) {
	const api = useTRPC();
	const router = useRouter();
	const [settings, setSettings] = useState(initialSettings);
	const [preferences, setPreferences] = useState(initialPreferences);
	const [dialog, setDialog] = useState<Dialogs>(null);
	const [nameDraft, setNameDraft] = useState("");
	const [dialDraft, setDialDraft] = useState("");
	const [sourcesDraft, setSourcesDraft] = useState<string[]>([]);
	const [sourceInput, setSourceInput] = useState("");
	const [copySource, setCopySource] = useState("");
	const canManage = settings.canManage;
	const lockTitle = canManage ? undefined : UNSUPPORTED.managerOnly;

	const update = useMutation(api.pancakeSettings.update.mutationOptions());
	const copy = useMutation(
		api.pancakeSettings.copyFrom.mutationOptions({
			onSuccess: (data) => {
				setSettings(data);
				setDialog(null);
				toast.success("Đã sao chép cấu hình");
				router.refresh();
			},
			onError: () =>
				toast.error(
					"Không thể sao chép. Bạn cần quyền quản lý ở cả hai workspace.",
				),
		}),
	);
	const updatePreferences = useMutation(
		api.pancakeSettings.updatePreferences.mutationOptions(),
	);

	function save(patch: SettingsPatch, close = false) {
		const previous = settings;
		setSettings({ ...previous, ...patch });
		update.mutate(
			{ shopId, ...patch },
			{
				onSuccess: (data) => {
					setSettings(data);
					if (close) setDialog(null);
					toast.success("Đã lưu cài đặt");
					router.refresh();
				},
				onError: () => {
					setSettings(previous);
					toast.error(SAVE_ERROR);
				},
			},
		);
	}

	function savePreferences(patch: PreferencesPatch) {
		const previous = preferences;
		setPreferences({ ...previous, ...patch });
		updatePreferences.mutate(
			{ shopId, ...patch },
			{
				onSuccess: (data) => {
					setPreferences(data);
					toast.success("Đã lưu thông báo cá nhân");
				},
				onError: () => {
					setPreferences(previous);
					toast.error(SAVE_ERROR);
				},
			},
		);
	}

	function addSource() {
		const value = sourceInput.trim();
		if (!value) return;
		if (sourcesDraft.length >= GENERAL_SETTINGS.limits.sources) {
			toast.error(`Tối đa ${GENERAL_SETTINGS.limits.sources} nguồn.`);
			return;
		}
		if (!sourcesDraft.includes(value))
			setSourcesDraft([...sourcesDraft, value]);
		setSourceInput("");
	}

	function saveDialCode() {
		const value = dialDraft.trim().replace(/^\+/, "");
		const pattern = new RegExp(
			`^\\d{1,${GENERAL_SETTINGS.limits.dialCodeDigits}}$`,
		);
		if (value && !pattern.test(value)) {
			toast.error(
				`Mã vùng gồm 1–${GENERAL_SETTINGS.limits.dialCodeDigits} chữ số.`,
			);
			return;
		}
		save({ dialCode: value || null }, true);
	}

	const busy = update.isPending;
	const countryLabel = (code: string) =>
		countries.find((option) => option.value === code)?.label ?? code;
	const addableCountries = countries.filter(
		(option) => !settings.countries.includes(option.value),
	);

	return (
		<>
			<SettingsRow
				title="Cấu hình cơ bản"
				description="Cài đặt đơn vị tiền tệ, phương thức thanh toán phù hợp"
			>
				<SettingsLine label="Tên và ảnh đại diện của workspace">
					<span className="text-muted-foreground text-xs">
						{settings.displayName ?? shopName}
					</span>
					<ConfigButton
						disabled={!canManage}
						title={lockTitle}
						onClick={() => {
							setNameDraft(settings.displayName ?? shopName);
							setDialog("name");
						}}
					/>
				</SettingsLine>
				<SettingsLine label="Đơn vị tiền tệ mặc định">
					<span title={lockTitle}>
						<OptionSelect
							label="Đơn vị tiền tệ mặc định"
							value={settings.currency}
							options={currencies}
							disabled={!canManage || busy}
							onChange={(currency) => save({ currency })}
						/>
					</span>
				</SettingsLine>
				<SettingsLine label="Mã shop Pancake POS">
					<span className="font-mono text-xs">{shopId}</span>
				</SettingsLine>
			</SettingsRow>
			<SettingsRow
				title="Cấu hình hệ thống"
				description="Điều chỉnh các thiết lập hệ thống phù hợp với mô hình vận hành"
			>
				<SettingsLine
					label="Sao chép cấu hình"
					hint="Sao chép cấu hình từ workspace khác"
				>
					<span
						title={
							shops.length === 0
								? "Không có workspace khác để sao chép"
								: lockTitle
						}
					>
						<Button
							variant="outline"
							size="sm"
							disabled={!canManage || shops.length === 0}
							onClick={() => {
								setCopySource("");
								setDialog("copy");
							}}
						>
							Sao chép
						</Button>
					</span>
				</SettingsLine>
				<SettingsLine
					label="Nguồn khách hàng"
					hint="Danh sách nguồn dùng cho tiềm năng, liên hệ và đơn hàng"
				>
					<span className="text-muted-foreground text-xs">
						{settings.customerSources.length} nguồn
					</span>
					<ConfigButton
						disabled={!canManage}
						title={lockTitle}
						onClick={() => {
							setSourcesDraft(settings.customerSources);
							setSourceInput("");
							setDialog("sources");
						}}
					/>
				</SettingsLine>
				<SettingsLine label="Hiển thị khách hàng có cùng số điện thoại trên hội thoại">
					<span title={lockTitle}>
						<Switch
							checked={settings.showSamePhoneOnConversation}
							disabled={!canManage || busy}
							onCheckedChange={(value) =>
								save({ showSamePhoneOnConversation: value })
							}
						/>
					</span>
				</SettingsLine>
				<SettingsLine label="Gộp đơn theo số điện thoại (bỏ mã quốc gia)">
					<span title={lockTitle}>
						<Switch
							checked={settings.mergeOrdersByPhone}
							disabled={!canManage || busy}
							onCheckedChange={(value) => save({ mergeOrdersByPhone: value })}
						/>
					</span>
				</SettingsLine>
			</SettingsRow>
			<SettingsRow
				title="Cấu hình đa quốc gia"
				description="Cài đặt múi giờ, quốc gia kinh doanh phù hợp"
			>
				<SettingsLine label="Chọn quốc gia kinh doanh">
					<div className="flex flex-wrap items-center justify-end gap-2">
						{settings.countries.map((code) => (
							<Badge key={code} variant="outline" className="h-8 gap-1 px-3">
								{countryLabel(code)}
								<Button
									variant="ghost"
									size="icon-xs"
									aria-label={`Bỏ ${countryLabel(code)}`}
									title={lockTitle}
									disabled={!canManage || busy}
									onClick={() =>
										save({
											countries: settings.countries.filter(
												(item) => item !== code,
											),
										})
									}
								>
									<Icon icon={Close} />
								</Button>
							</Badge>
						))}
						<span title={lockTitle}>
							<OptionSelect
								label="Thêm quốc gia"
								value=""
								placeholder="Thêm quốc gia"
								options={addableCountries}
								disabled={
									!canManage ||
									busy ||
									settings.countries.length >= GENERAL_SETTINGS.limits.countries
								}
								onChange={(code) =>
									save({ countries: [...settings.countries, code] })
								}
							/>
						</span>
					</div>
				</SettingsLine>
				<SettingsLine label="Múi giờ">
					<span title={lockTitle}>
						<OptionSelect
							label="Múi giờ"
							value={settings.timezone}
							options={timezones}
							disabled={!canManage || busy}
							onChange={(timezone) => save({ timezone })}
						/>
					</span>
				</SettingsLine>
				<SettingsLine label="Mã vùng điện thoại">
					<span className="text-xs">
						{settings.dialCode ? `+${settings.dialCode}` : "Chưa đặt"}
					</span>
					<span title={lockTitle}>
						<Button
							variant="outline"
							size="sm"
							disabled={!canManage}
							onClick={() => {
								setDialDraft(settings.dialCode ?? "");
								setDialog("dialCode");
							}}
						>
							Sửa
						</Button>
					</span>
				</SettingsLine>
			</SettingsRow>
			<SettingsRow
				title="Thông báo cá nhân"
				description="Tuỳ chỉnh thông báo theo tài khoản cá nhân"
			>
				<SettingsLine
					label="Tắt thông báo ứng dụng"
					hint="Không nhận thông báo trong CRM"
				>
					<Switch
						checked={preferences.disableAppNotifications}
						disabled={updatePreferences.isPending}
						onCheckedChange={(value) =>
							savePreferences({ disableAppNotifications: value })
						}
					/>
				</SettingsLine>
				<SettingsLine
					label="Thông báo qua trình duyệt"
					hint="Cần cho phép thông báo trên trình duyệt"
				>
					<Switch
						checked={preferences.browserNotifications}
						disabled={updatePreferences.isPending}
						onCheckedChange={(value) => {
							if (
								value &&
								"Notification" in window &&
								Notification.permission === "default"
							)
								Notification.requestPermission().catch(() => undefined);
							savePreferences({ browserNotifications: value });
						}}
					/>
				</SettingsLine>
				<SettingsLine label="Âm thanh">
					<OptionSelect
						label="Âm thanh"
						value={preferences.sound}
						options={sounds}
						disabled={updatePreferences.isPending}
						onChange={(sound) => savePreferences({ sound })}
					/>
				</SettingsLine>
			</SettingsRow>
			<SettingsRow
				title="Xóa Workspace"
				description="Toàn bộ dữ liệu sẽ bị xóa vĩnh viễn và không thể khôi phục"
			>
				<div className="flex justify-end">
					<Unsupported reason={UNSUPPORTED.deleteWorkspace}>
						<Button
							variant="outline"
							className="border-destructive text-destructive"
							disabled
						>
							Xóa Workspace
						</Button>
					</Unsupported>
				</div>
			</SettingsRow>

			<Dialog
				open={dialog !== null}
				onOpenChange={(open) => !open && setDialog(null)}
			>
				<DialogContent>
					{dialog === "name" ? (
						<>
							<DialogHeader>
								<DialogTitle>Tên workspace</DialogTitle>
								<DialogDescription>
									Tên hiển thị trong CRM. Để trống để dùng tên shop POS.
								</DialogDescription>
							</DialogHeader>
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="settings-display-name">Tên hiển thị</Label>
								<Input
									id="settings-display-name"
									value={nameDraft}
									maxLength={GENERAL_SETTINGS.limits.displayName}
									onChange={(event) => setNameDraft(event.target.value)}
								/>
							</div>
							<DialogFooter>
								<Button variant="outline" onClick={() => setDialog(null)}>
									Hủy
								</Button>
								<Button
									disabled={busy}
									onClick={() =>
										save({ displayName: nameDraft.trim() || null }, true)
									}
								>
									Lưu
								</Button>
							</DialogFooter>
						</>
					) : null}
					{dialog === "copy" ? (
						<>
							<DialogHeader>
								<DialogTitle>Sao chép cấu hình</DialogTitle>
								<DialogDescription>
									Tiền tệ, múi giờ, quốc gia, mã vùng, nguồn khách hàng và các
									tùy chọn hệ thống được ghi đè. Tên workspace giữ nguyên.
								</DialogDescription>
							</DialogHeader>
							<div className="flex flex-col gap-1.5">
								<Label>Sao chép từ workspace</Label>
								<OptionSelect
									label="Workspace nguồn"
									value={copySource}
									placeholder="Chọn workspace"
									options={shops}
									disabled={copy.isPending}
									onChange={setCopySource}
								/>
							</div>
							<DialogFooter>
								<Button variant="outline" onClick={() => setDialog(null)}>
									Hủy
								</Button>
								<Button
									disabled={!copySource || copy.isPending}
									onClick={() =>
										copy.mutate({
											sourceShopId: copySource,
											targetShopId: shopId,
										})
									}
								>
									{copy.isPending ? "Đang sao chép…" : "Sao chép"}
								</Button>
							</DialogFooter>
						</>
					) : null}
					{dialog === "sources" ? (
						<>
							<DialogHeader>
								<DialogTitle>Nguồn khách hàng</DialogTitle>
								<DialogDescription>
									Danh sách nguồn dùng cho tiềm năng, liên hệ và đơn hàng.
								</DialogDescription>
							</DialogHeader>
							<div className="flex flex-wrap gap-2">
								{sourcesDraft.length === 0 ? (
									<span className="text-muted-foreground text-xs">
										Chưa có nguồn nào.
									</span>
								) : (
									sourcesDraft.map((source) => (
										<Badge key={source} variant="outline" className="gap-1">
											{source}
											<Button
												variant="ghost"
												size="icon-xs"
												aria-label={`Xóa ${source}`}
												onClick={() =>
													setSourcesDraft(
														sourcesDraft.filter((item) => item !== source),
													)
												}
											>
												<Icon icon={Close} />
											</Button>
										</Badge>
									))
								)}
							</div>
							<form
								className="flex gap-2"
								onSubmit={(event) => {
									event.preventDefault();
									addSource();
								}}
							>
								<Input
									value={sourceInput}
									maxLength={GENERAL_SETTINGS.limits.source}
									placeholder="Ví dụ: Facebook, TikTok, Website"
									aria-label="Tên nguồn"
									onChange={(event) => setSourceInput(event.target.value)}
								/>
								<Button type="submit" variant="outline">
									Thêm
								</Button>
							</form>
							<DialogFooter>
								<Button variant="outline" onClick={() => setDialog(null)}>
									Hủy
								</Button>
								<Button
									disabled={busy}
									onClick={() => save({ customerSources: sourcesDraft }, true)}
								>
									Lưu
								</Button>
							</DialogFooter>
						</>
					) : null}
					{dialog === "dialCode" ? (
						<>
							<DialogHeader>
								<DialogTitle>Mã vùng điện thoại</DialogTitle>
								<DialogDescription>
									Mã quốc gia mặc định khi chuẩn hóa số điện thoại. Để trống để
									bỏ.
								</DialogDescription>
							</DialogHeader>
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="settings-dial-code">Mã vùng</Label>
								<Input
									id="settings-dial-code"
									value={dialDraft}
									inputMode="numeric"
									placeholder="966"
									maxLength={GENERAL_SETTINGS.limits.dialCodeDigits + 1}
									onChange={(event) => setDialDraft(event.target.value)}
								/>
							</div>
							<DialogFooter>
								<Button variant="outline" onClick={() => setDialog(null)}>
									Hủy
								</Button>
								<Button disabled={busy} onClick={saveDialCode}>
									Lưu
								</Button>
							</DialogFooter>
						</>
					) : null}
				</DialogContent>
			</Dialog>
		</>
	);
}
