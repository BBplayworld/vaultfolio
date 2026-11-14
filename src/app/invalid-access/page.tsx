import Link from "next/link";
import { ShieldAlert, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function InvalidAccessPage() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center p-6 text-center space-y-6 bg-background">
      <div className="rounded-full bg-destructive/10 p-4">
        <ShieldAlert className="size-12 text-destructive" />
      </div>
      
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          잘못된 접근입니다
        </h1>
        <p className="text-muted-foreground text-sm md:text-base max-w-md mx-auto leading-relaxed">
          공유 링크가 만료되었거나, URL의 형태가 손상되어 데이터를 안전하게 불러올 수 없습니다. 
          전송받은 전체 URL이 올바른지 다시 확인해 주세요.
        </p>
        <p data-testid="invalid-access-onetime" className="text-muted-foreground text-xs md:text-sm max-w-md mx-auto break-keep text-pretty">
          1회용 링크는 한 번 열리면 다시 열 수 없어요. 보낸 쪽에서 새로 전달받아 주세요.
        </p>
      </div>

      <div className="pt-4">
        <Button asChild size="lg" className="gap-2">
          <Link replace href="/">
            <Home className="size-4" />
            내 자산 홈으로 돌아가기
          </Link>
        </Button>
      </div>
    </div>
  );
}
