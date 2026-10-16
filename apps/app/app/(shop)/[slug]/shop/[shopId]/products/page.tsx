import SettingsAdjust from "@carbon/icons-react/es/SettingsAdjust";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import Link from "next/link";
import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import { formatAmount } from "@/components/pancake/format";
import { COLLECTIONS, PRODUCT_TYPES } from "@/components/shop/collections";
import {
	FilterBar,
	FilterButton,
	FilterChip,
	MoreMenu,
	SearchBox,
} from "@/components/shop/filter-bar";
import { Dash, ListFooter, ListTable } from "@/components/shop/list-table";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { ShopPage, ShopPageBody, ShopPageHeader } from "@/components/shop/page";
import {
	type SearchValues,
	shopFilters,
	withParams,
} from "@/components/shop/params";
import {
	ProductImageThumb,
	ProductTypeHoverBadge,
} from "@/components/shop/product-image-preview";
import { CreateRecordButton } from "@/components/shop/record-sheet";
import { shopProfile } from "@/components/shop/shop-profile";

export default function ProductsPage(props: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	return (
		<Suspense fallback={<PageShellLoading />}>
			<Products {...props} />
		</Suspense>
	);
}

async function Products({
	params,
	searchParams,
}: {
	params: Promise<ShopRoute>;
	searchParams: Promise<SearchValues>;
}) {
	const [ctx, values] = await Promise.all([loadShop(params), searchParams]);
	const filter = shopFilters(values, ctx.shopId);
	const products = await ctx.api.products.query(filter.input);
	const collection = COLLECTIONS.product;
	const currency = shopProfile(ctx.shopId).currency;
	const columns = collection.fields
		.filter((field) => field.list)
		.map((field) => ({ key: field.key, label: field.label }));
	const variations = new Map<string, number>();
	for (const row of products.rows)
		variations.set(row.productId, (variations.get(row.productId) ?? 0) + 1);
	const page = `${ctx.base}/products`;

	return (
		<ShopPage>
			<ShopPageHeader
				title={collection.title}
				description={collection.description}
				actions={
					<>
						<Button asChild variant="outline">
							<Link href={`${ctx.base}/settings/tools/fields/product`}>
								<Icon icon={SettingsAdjust} data-icon="inline-start" />
								Giao diện
							</Link>
						</Button>
						<CreateRecordButton
							collection="product"
							menu={[
								{ label: "Nhập từ Excel" },
								{ label: "Đồng bộ từ Pancake POS" },
							]}
						/>
					</>
				}
			/>
			<ShopPageBody>
				<FilterBar
					toolbar={
						<>
							<SearchBox placeholder="Tên sản phẩm, SKU" className="w-56" />
							<FilterButton
								fields={collection.fields.map((f) => ({
									value: f.key,
									label: f.label,
								}))}
							/>
							<MoreMenu />
						</>
					}
				>
					<FilterChip
						label="Loại hình"
						param="type"
						multiple
						options={PRODUCT_TYPES}
					/>
					<FilterChip label="Danh mục" param="category" multiple options={[]} />
				</FilterBar>
				<ListTable
					columns={columns}
					rows={products.rows.map((product) => {
						const skuText = product.sku ?? product.variationId;
						const priceLabel = product.price
							? formatAmount(product.price, currency)
							: null;
						return {
							key: product.variationId,
							cells: [
								<span
									key="name"
									className="flex items-center gap-2 font-medium"
								>
									{product.name}
									{product.hidden ? <Badge variant="gray">Đã ẩn</Badge> : null}
								</span>,
								skuText,
								<ProductTypeHoverBadge
									key="type"
									name={product.name}
									sku={skuText}
									imageUrl={product.imageUrl}
									priceLabel={priceLabel}
								/>,
								variations.get(product.productId) ?? 1,
								<ProductImageThumb
									key="image"
									name={product.name}
									sku={skuText}
									imageUrl={product.imageUrl}
									priceLabel={priceLabel}
								/>,
								priceLabel ?? <Dash key="price" />,
								product.stock ?? <Dash key="stock" />,
								<Dash key="duration" />,
								product.description ? (
									<span key="desc" className="truncate">
										{product.description}
									</span>
								) : (
									<Dash key="description" />
								),
								product.categories.length > 0 ? (
									<span key="cat">{product.categories.join(", ")}</span>
								) : (
									<Dash key="category" />
								),
							],
						};
					})}
				/>
				<ListFooter
					total={products.total}
					page={filter.input.page}
					pageSize={filter.input.pageSize}
					unit="sản phẩm"
					pageHref={(next) => withParams(page, values, { page: String(next) })}
				/>
			</ShopPageBody>
		</ShopPage>
	);
}
