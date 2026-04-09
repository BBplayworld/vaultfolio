export function CopyrightFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-4 py-4 border-t border-border/50 text-center">
      <p className="text-xs text-muted-foreground">
        © {year} SecretAsset. All rights reserved.
      </p>
      <p className="text-xs text-muted-foreground/60 mt-1">
        본 서비스는 개인 자산 관리 목적으로 제공되며, 투자 조언을 포함하지 않습니다.
      </p>
    </footer>
  );
}
