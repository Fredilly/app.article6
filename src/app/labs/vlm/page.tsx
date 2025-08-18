import AppLayout from "@/components/layout/AppLayout";
import PageTemplate from "@/components/PageTemplate";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function VLMPage() {
  return (
    <AppLayout breadcrumb={<span>Home ▸ Labs ▸ Vision</span>}>
      <PageTemplate
        title="Vision Lab"
        subtitle="Upload a map screenshot or image and chat. (Backend hook comes later.)"
        actions={
          <div className="flex gap-2 sticky top-0">
            <Button>Upload image</Button>
            <Button variant="secondary">Clear</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <Card className="p-4 h-[60vh] overflow-auto">ChatPane (placeholder)</Card>
            <p className="text-xs text-muted-foreground">
              Typing and streaming to be wired to API in next task.
            </p>
          </div>
          <Card className="p-4 h-[60vh]">PreviewPane (image placeholder)</Card>
        </div>
      </PageTemplate>
    </AppLayout>
  );
}
