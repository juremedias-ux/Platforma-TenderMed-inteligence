import { redirect } from "next/navigation";
import { Suspense } from "react";

async function Redirect({ params }: { params: PageProps<"/app/[organizationId]">["params"] }) {
  const { organizationId } = await params;
  redirect(`/app/${organizationId}/pregled`);
  return null;
}

export default function OrganizationIndex({ params }: PageProps<"/app/[organizationId]">) {
  return (
    <Suspense fallback={null}>
      <Redirect params={params} />
    </Suspense>
  );
}
