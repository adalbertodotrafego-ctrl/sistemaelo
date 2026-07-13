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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FolderOpen, FolderPlus, Upload, Download, ChevronRight, File as FileIcon,
  Image as ImageIcon, FileText, MoreVertical, Pencil, Trash2, Eye, ExternalLink,
} from "lucide-react";
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

  const [editFolderTarget, setEditFolderTarget] = useState<any>(null);
  const [editFolderForm, setEditFolderForm] = useState({ name: "", client_id: "" });
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<any>(null);

  const [editFileTarget, setEditFileTarget] = useState<any>(null);
  const [editFileForm, setEditFileForm] = useState({ name: "", client_id: "" });
  const [deleteFileTarget, setDeleteFileTarget] = useState<any>(null);

  const [previewFile, setPreviewFile] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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

  const updateFolder = useMutation({
    mutationFn: async () => {
      if (!editFolderTarget) return;
      const { error } = await supabase.from("folders")
        .update({ name: editFolderForm.name, client_id: editFolderForm.client_id || null })
        .eq("id", editFolderTarget.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folders"] });
      setEditFolderTarget(null);
      toast.success("Pasta atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteFolder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("folders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folders"] });
      qc.invalidateQueries({ queryKey: ["files"] });
      setDeleteFolderTarget(null);
      toast.success("Pasta excluída!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateFile = useMutation({
    mutationFn: async () => {
      if (!editFileTarget) return;
      const { error } = await supabase.from("files")
        .update({ name: editFileForm.name, client_id: editFileForm.client_id || null })
        .eq("id", editFileTarget.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["files"] });
      setEditFileTarget(null);
      toast.success("Arquivo atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteFile = useMutation({
    mutationFn: async (f: any) => {
      const { error } = await supabase.from("files").delete().eq("id", f.id);
      if (error) throw error;
      await supabase.storage.from("project-files").remove([f.path]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["files"] });
      setDeleteFileTarget(null);
      toast.success("Arquivo excluído!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const download = async (path: string) => {
    const { data, error } = await supabase.storage.from("project-files").createSignedUrl(path, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  const openPreview = async (f: any) => {
    setPreviewFile(f);
    setPreviewUrl(null);
    const { data, error } = await supabase.storage.from("project-files").createSignedUrl(f.path, 300);
    if (error) { toast.error(error.message); setPreviewFile(null); return; }
    setPreviewUrl(data.signedUrl);
  };

  const openEditFolder = (f: any) => {
    setEditFolderTarget(f);
    setEditFolderForm({ name: f.name ?? "", client_id: f.client_id ?? "" });
  };

  const openEditFile = (f: any) => {
    setEditFileTarget(f);
    setEditFileForm({ name: f.name ?? "", client_id: f.client_id ?? "" });
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
            <div key={f.id} className="surface-card group relative flex items-center gap-3 p-4 text-left transition hover:border-primary/40 hover:shadow-elegant">
              <button onClick={() => setParentId(f.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <div className="rounded-lg bg-amber-500/15 p-2 text-amber-400"><FolderOpen className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <div className="truncate font-medium">{f.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{f.clients?.name ?? "Pasta"}</div>
                </div>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="rounded p-1 text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground group-hover:opacity-100"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEditFolder(f)}><Pencil className="mr-2 h-3.5 w-3.5" />Editar</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDeleteFolderTarget(f)} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-3.5 w-3.5" />Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
          {currentFiles.map((f: any) => {
            const Icon = fileIcon(f.mime);
            return (
              <div key={f.id} className="surface-card group flex items-center gap-3 p-4">
                <div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{f.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{fmtSize(f.size)}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => download(f.path)} title="Baixar"><Download className="h-4 w-4" /></Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openPreview(f)}><Eye className="mr-2 h-3.5 w-3.5" />Visualizar</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openEditFile(f)}><Pencil className="mr-2 h-3.5 w-3.5" />Editar</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDeleteFileTarget(f)} className="text-destructive focus:text-destructive">
                      <Trash2 className="mr-2 h-3.5 w-3.5" />Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}

      {/* Editar pasta */}
      <Dialog open={!!editFolderTarget} onOpenChange={(v) => !v && setEditFolderTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar pasta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={editFolderForm.name} onChange={e => setEditFolderForm({ ...editFolderForm, name: e.target.value })} /></div>
            <div><Label>Cliente (opcional)</Label>
              <Select value={editFolderForm.client_id} onValueChange={v => setEditFolderForm({ ...editFolderForm, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{(clients ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditFolderTarget(null)}>Cancelar</Button>
            <Button onClick={() => updateFolder.mutate()} disabled={!editFolderForm.name || updateFolder.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar arquivo */}
      <Dialog open={!!editFileTarget} onOpenChange={(v) => !v && setEditFileTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar arquivo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={editFileForm.name} onChange={e => setEditFileForm({ ...editFileForm, name: e.target.value })} /></div>
            <div><Label>Cliente (opcional)</Label>
              <Select value={editFileForm.client_id} onValueChange={v => setEditFileForm({ ...editFileForm, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{(clients ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditFileTarget(null)}>Cancelar</Button>
            <Button onClick={() => updateFile.mutate()} disabled={!editFileForm.name || updateFile.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visualizar arquivo */}
      <Dialog open={!!previewFile} onOpenChange={(v) => { if (!v) { setPreviewFile(null); setPreviewUrl(null); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="truncate">{previewFile?.name}</DialogTitle></DialogHeader>
          {!previewUrl ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Carregando…</div>
          ) : previewFile?.mime?.startsWith("image/") ? (
            <img src={previewUrl} alt={previewFile?.name} className="max-h-[70vh] w-full rounded-lg object-contain" />
          ) : previewFile?.mime?.includes("pdf") ? (
            <iframe src={previewUrl} className="h-[70vh] w-full rounded-lg border border-border/60" title={previewFile?.name} />
          ) : (
            <div className="flex flex-col items-center gap-3 py-12 text-center text-sm text-muted-foreground">
              <p>Pré-visualização não disponível para este tipo de arquivo.</p>
              <Button variant="outline" onClick={() => window.open(previewUrl, "_blank")}>
                <ExternalLink className="mr-2 h-4 w-4" />Abrir em nova aba
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteFolderTarget} onOpenChange={(v) => !v && setDeleteFolderTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pasta?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai excluir "{deleteFolderTarget?.name}" e todas as subpastas dentro dela. Os arquivos que estavam
              nela não são apagados — ficam movidos para a raiz. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteFolder.mutate(deleteFolderTarget.id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteFileTarget} onOpenChange={(v) => !v && setDeleteFileTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir arquivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai excluir "{deleteFileTarget?.name}" permanentemente, incluindo o arquivo enviado. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteFile.mutate(deleteFileTarget)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
