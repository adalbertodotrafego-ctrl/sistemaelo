import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-extras/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FolderOpen, FolderPlus, Upload, Download, ChevronRight, File as FileIcon, Image as ImageIcon, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/files")({
  head: () => ({ meta: [{ title: "Arquivos — Elo Marketing OS" }] }),
  component: FilesPage,
});

function fileIcon(mime: string | null) {
  if (!mime) return FileIcon;
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.includes("pdf") || mime.includes("text")) return FileText;
  return FileIcon;
}

function fmtSize(s: number | null) {
  if (!s) return "—";
  if (s < 1024) return s + " B";
  if (s < 1024 * 1024) return (s / 1024).toFixed(1) + " KB";
  return (s / 1024 / 1024).toFixed(1) + " MB";
}

function FilesPage() {
  const qc = useQueryClient();
  const [parentId, setParentId] = useState<string | null>(null);
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderClient, setFolderClient] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: folders } = useQuery({
    queryKey: ["folders"],
    queryFn: async () => (await supabase.from("folders").select("*, clients(name)").order("name")).data ?? [],
  });
  const { data: files } = useQuery({
    queryKey: ["files"],
    queryFn: async () => (await supabase.from("files").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: clients } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data ?? [],
  });

  const currentFolders = (folders ?? []).filter((f: any) => f.parent_id === parentId);
  const currentFiles = (files ?? []).filter((f: any) => f.folder_id === parentId);
  const currentFolder = parentId ? (folders ?? []).find((f: any) => f.id === parentId) : null;

  const createFolder = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("folders").insert({
        name: folderName, parent_id: parentId, client_id: folderClient || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folders"] });
      setFolderOpen(false); setFolderName(""); setFolderClient("");
      toast.success("Pasta criada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error("Selecione um arquivo");
      setUploading(true);
      const ext = uploadFile.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("project-files").upload(path, uploadFile);
      if (upErr) throw upErr;
      const { error } = await supabase.from("files").insert({
        name: uploadFile.name, path, mime: uploadFile.type, size: uploadFile.size,
        folder_id: parentId, client_id: currentFolder?.client_id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["files"] });
      setUploadOpen(false); setUploadFile(null); setUploading(false);
      toast.success("Arquivo enviado!");
    },
    onError: (e: Error) => { setUploading(false); toast.error(e.message); },
  });

  const download = async (path: string) => {
    const { data, error } = await supabase.storage.from("project-files").createSignedUrl(path, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  const breadcrumb: any[] = [];
  let cur: any = currentFolder;
  while (cur) {
    breadcrumb.unshift(cur);
    cur = cur.parent_id ? (folders ?? []).find((f: any) => f.id === cur.parent_id) : null;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Agência"
        title="Arquivos"
        description="Drive interno: pastas, mídias e documentos por cliente."
        actions={
          <>
            <Dialog open={folderOpen} onOpenChange={setFolderOpen}>
              <DialogTrigger asChild><Button variant="outline"><FolderPlus className="mr-2 h-4 w-4" />Nova pasta</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova pasta</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Nome *</Label><Input value={folderName} onChange={e => setFolderName(e.target.value)} /></div>
                  <div><Label>Cliente (opcional)</Label>
                    <Select value={folderClient} onValueChange={setFolderClient}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{(clients ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setFolderOpen(false)}>Cancelar</Button>
                  <Button onClick={() => createFolder.mutate()} disabled={!folderName}>Criar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogTrigger asChild><Button><Upload className="mr-2 h-4 w-4" />Upload</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Enviar arquivo</DialogTitle></DialogHeader>
                <Input type="file" onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setUploadOpen(false)}>Cancelar</Button>
                  <Button onClick={() => upload.mutate()} disabled={!uploadFile || uploading}>{uploading ? "Enviando..." : "Enviar"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="mb-4 flex items-center gap-1 text-sm text-muted-foreground">
        <button onClick={() => setParentId(null)} className="hover:text-foreground">Raiz</button>
        {breadcrumb.map((b: any) => (
          <span key={b.id} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3" />
            <button onClick={() => setParentId(b.id)} className="hover:text-foreground">{b.name}</button>
          </span>
        ))}
      </div>

      {currentFolders.length === 0 && currentFiles.length === 0 ? (
        <EmptyState icon={FolderOpen} title="Pasta vazia" description="Crie uma subpasta ou envie um arquivo." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {currentFolders.map((f: any) => (
            <button key={f.id} onClick={() => setParentId(f.id)}
              className="surface-card flex items-center gap-3 p-4 text-left transition hover:border-primary/40 hover:shadow-elegant">
              <div className="rounded-lg bg-amber-500/15 p-2 text-amber-400"><FolderOpen className="h-5 w-5" /></div>
              <div className="min-w-0">
                <div className="truncate font-medium">{f.name}</div>
                <div className="truncate text-[11px] text-muted-foreground">{f.clients?.name ?? "Pasta"}</div>
              </div>
            </button>
          ))}
          {currentFiles.map((f: any) => {
            const Icon = fileIcon(f.mime);
            return (
              <div key={f.id} className="surface-card flex items-center gap-3 p-4">
                <div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{f.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{fmtSize(f.size)}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => download(f.path)}><Download className="h-4 w-4" /></Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
