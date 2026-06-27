# 종목 마스터 데이터

스크린샷 종목코드 해석(이름→코드/티커)의 권위 소스. 수기 맵 대신 전체 마스터를 사용한다.

- `kr-stock-master.json` — 코스피·코스닥·코넥스 전종목 (`{ code, name(약명), fullName(종목명), market(시장구분), kind(주식종류) }`)
- `kr-etf-master.json` — 국내 ETF 전체 (`{ code, name(약명), fullName(종목명), market(기초시장분류) }`)
- `us-stock-master.json` — 미국 주식(보통주/ADS) (`{ ticker, name, exchange(NAS/NYS/AMS) }`)
- `us-etf-master.json` — 미국 ETF 전체(레버리지 포함) (`{ ticker, name, assetClass }`)

소비처: 국내=`src/lib/kr-master.ts`, 미국=`src/lib/us-master.ts`

## 재생성 (KRX 마스터 갱신 시)

KRX 정보데이터시스템에서 전종목/ETF 목록 CSV(CP949)를 받아 아래 PowerShell로 변환한다.

```powershell
# 주식 (헤더: 표준코드,단축코드,한글 종목명,한글 종목약명,...,시장구분,증권구분,소속부,주식종류,...)
$s="<주식CSV경로>"; $enc=[System.Text.Encoding]::GetEncoding(949)
$rows=[System.IO.File]::ReadAllText($s,$enc) | ConvertFrom-Csv
$out=$rows | ForEach-Object { [ordered]@{ code=$_.단축코드.Trim(); name=$_.'한글 종목약명'.Trim(); fullName=$_.'한글 종목명'.Trim(); market=$_.시장구분.Trim(); kind=$_.주식종류.Trim() } }
[System.IO.File]::WriteAllText("kr-stock-master.json", ($out | ConvertTo-Json -Depth 3), (New-Object System.Text.UTF8Encoding($false)))

# ETF (헤더: 표준코드,단축코드,한글종목명,한글종목약명,...,기초시장분류,...)
$e="<ETF CSV경로>"
$rows=[System.IO.File]::ReadAllText($e,$enc) | ConvertFrom-Csv
$out=$rows | ForEach-Object { [ordered]@{ code=$_.단축코드.Trim(); name=$_.한글종목약명.Trim(); fullName=$_.한글종목명.Trim(); market=$_.기초시장분류.Trim() } }
[System.IO.File]::WriteAllText("kr-etf-master.json", ($out | ConvertTo-Json -Depth 3), (New-Object System.Text.UTF8Encoding($false)))
```

> UTF-8(BOM 없음)으로 저장한다. 소비처: `src/lib/kr-master.ts`

## 재생성 (미국 마스터 갱신 시)

- 주식: nasdaq.com 스크리너 CSV(`Symbol,Name,...`) + NASDAQ Trader otherlisted CSV(`ACT Symbol,...,Exchange,ETF,...`)
- ETF: ETF 목록 CSV(`Ticker,Fund Name,Asset Class,Assets`)

```powershell
$enc=[System.Text.Encoding]::UTF8
# 주식 — 보통주/ADS만 유지, other-listed로 거래소 보강
$n=Import-Csv '<nasdaq.csv>'; $o=Import-Csv '<other-listed.csv>'
$exMap=@{}; foreach($r in $o){ if($r.ETF -ne 'Y' -and -not $exMap.ContainsKey($r.'ACT Symbol')){ $c=$r.Exchange; $exMap[$r.'ACT Symbol']= if($c -eq 'N'){'NYS'}elseif($c -eq 'A'){'AMS'}else{'NAS'} } }
$keep='(?i)(class\s+[a-z0-9]+\s+)?(common stock|common shares|ordinary shares|american depositary shares)\s*$'
$strip='(?i)\s*-?\s*(class\s+[a-z0-9]+\s+)?(common stock|common shares|ordinary shares|american depositary shares)\s*$'
$out=@(); foreach($r in $n){ if($r.Name -notmatch $keep){continue}; $nm=($r.Name -replace $strip,'').Trim(); if(-not $nm){continue}; $tk=$r.Symbol.Trim(); $ex= if($exMap.ContainsKey($tk)){$exMap[$tk]}else{'NAS'}; $out += [ordered]@{ ticker=$tk; name=$nm; exchange=$ex } }
[System.IO.File]::WriteAllText("us-stock-master.json", ($out|ConvertTo-Json -Depth 3), (New-Object System.Text.UTF8Encoding($false)))

# ETF — 전체(레버리지 포함)
$e=Import-Csv '<us_etf.csv>'
$out=$e | ForEach-Object { [ordered]@{ ticker=$_.Ticker.Trim(); name=$_.'Fund Name'.Trim(); assetClass=$_.'Asset Class'.Trim() } }
[System.IO.File]::WriteAllText("us-etf-master.json", ($out|ConvertTo-Json -Depth 3), (New-Object System.Text.UTF8Encoding($false)))
```

> 소비처: `src/lib/us-master.ts`
