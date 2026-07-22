import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/features/_shared/queryKeys";
import { deleteProduct, fetchProducts, upsertProduct, type Product, type ProductUpsert } from "./api";

export function useProducts() {
  return useQuery<Product[]>({
    queryKey: qk.products.list(),
    queryFn: fetchProducts,
    staleTime: 30_000,
  });
}

export function useUpsertProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string | null; payload: ProductUpsert }) => upsertProduct(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.products.all }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.products.all }),
  });
}
