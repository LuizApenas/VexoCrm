import React, { useState } from "react";
import { Database, FileText, Upload, Trash2, Search, CheckCircle2, RefreshCw, FileUp, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface RagDocument {
  id: string;
  name: string;
  size: string;
  chunks: number;
  tokens: number;
  uploadedAt: string;
  status: "ready" | "processing";
}

export function KnowledgeBaseRagTab() {
  const [documents, setDocuments] = useState<RagDocument[]>([
    {
      id: "doc-1",
      name: "Tabela_Precos_Propostas_2026.pdf",
      size: "2.4 MB",
      chunks: 48,
      tokens: 12450,
      uploadedAt: "Hoje, 14:30",
      status: "ready",
    },
    {
      id: "doc-2",
      name: "Manual_Tecnico_Dimensionamento_Fotovoltaico.pdf",
      size: "5.1 MB",
      chunks: 112,
      tokens: 31200,
      uploadedAt: "Ontem, 18:10",
      status: "ready",
    },
    {
      id: "doc-3",
      name: "FAQ_Objecoes_Contratuais_Garantias.docx",
      size: "840 KB",
      chunks: 24,
      tokens: 6100,
      uploadedAt: "10/08/2026",
      status: "ready",
    },
  ]);

  const [searchTest, setSearchTest] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleTestSearch = () => {
    if (!searchTest.trim()) return;
    setIsSearching(true);
    setTimeout(() => {
      setIsSearching(false);
      setTestResult(
        `[Chunk #14 de "Tabela_Precos_Propostas_2026.pdf" (Similaridade: 94.2%)]:\n"O Plano Vexo Essencial contempla a gestão unificada de leads e 1 chip de atendimento. O Plano Avançado inclui múltiplos chips, variações antiban Groq AI e recuperação RAG de documentos técnicos."`
      );
    }, 600);
  };

  const handleFakeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const newDoc: RagDocument = {
      id: `doc-${Date.now()}`,
      name: file.name,
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      chunks: Math.floor(Math.random() * 30) + 10,
      tokens: Math.floor(Math.random() * 10000) + 2000,
      uploadedAt: "Agora",
      status: "ready",
    };

    setDocuments((prev) => [newDoc, ...prev]);
    toast.success(`Arquivo "${file.name}" indexado no banco vetorial RAG com sucesso!`);
  };

  const handleDelete = (id: string, name: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    toast.success(`Documento "${name}" removido da base de conhecimento.`);
  };

  return (
    <div className="space-y-6 animate-in fade-in-50">
      {/* Upload Zone */}
      <Card className="border-border dark:border-zinc-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Base de Conhecimento Vetorial RAG</CardTitle>
                <CardDescription className="text-xs">
                  Faça upload de catálogos, tabelas de preços, manuais técnicos e políticas da empresa em PDF ou DOCX para o Agente IA consultar em tempo real sem alucinações.
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="bg-cyan-500/10 text-cyan-600 border-cyan-500/30 text-xs font-bold">
              ⚡ Vector Search (RAG)
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-border dark:border-zinc-800 rounded-xl p-6 text-center hover:border-cyan-500/50 transition-colors bg-muted/10 cursor-pointer relative">
            <input
              type="file"
              accept=".pdf,.docx,.txt,.csv"
              onChange={handleFakeUpload}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                <FileUp className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                Clique ou arraste seus arquivos aqui para indexar no RAG
              </p>
              <p className="text-xs text-muted-foreground">
                Formatos suportados: PDF, DOCX, TXT, CSV (Até 25 MB por arquivo)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documentos Indexados */}
      <Card className="border-border dark:border-zinc-800">
        <CardHeader className="p-4 pb-2 border-b border-border dark:border-zinc-800">
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-cyan-500" />
            Documentos Indexados na Base ({documents.length})
          </span>
        </CardHeader>
        <CardContent className="p-3 space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 rounded-xl border border-border dark:border-zinc-800 bg-muted/20 text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-600">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{doc.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {doc.size} • {doc.chunks} chunks • {doc.tokens.toLocaleString("pt-BR")} tokens • Adicionado {doc.uploadedAt}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Pronto
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(doc.id, doc.name)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Teste de Recuperação Vetorial */}
      <Card className="border-border dark:border-zinc-800">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-xs font-bold flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-cyan-500" />
            Simulador de Busca Semântica RAG
          </CardTitle>
          <CardDescription className="text-[11px]">
            Faça uma pergunta como se fosse o cliente para ver qual trecho de documento o motor de IA recupera.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Ex.: Quais os diferenciais e preços do Plano Avançado?"
              value={searchTest}
              onChange={(e) => setSearchTest(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTestSearch()}
              className="text-xs"
            />
            <Button
              size="sm"
              onClick={handleTestSearch}
              disabled={isSearching || !searchTest.trim()}
              className="text-xs bg-cyan-600 hover:bg-cyan-700 text-white gap-1.5"
            >
              {isSearching ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
              Testar RAG
            </Button>
          </div>

          {testResult && (
            <div className="p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20 text-xs space-y-1 font-mono text-muted-foreground">
              <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 block font-sans">
                Trecho Mais Relevante Recuperado:
              </span>
              <p className="whitespace-pre-line leading-relaxed text-foreground">{testResult}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
