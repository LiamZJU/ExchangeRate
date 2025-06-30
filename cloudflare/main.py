from js import Response, fetch, Headers
import json
import time
from urllib.parse import urlparse, urlencode
import urllib.request
import urllib.error

# 银行配置 - 完整版，包含所有支持的银行
BANKS = {
    'cib': {
        'code': 'cib',
        'name': '兴业银行',
        'url_business': 'https://personalbank.cib.com.cn/pers/main/pubinfo/ifxQuotationQuery.do',
        'url_api': 'https://personalbank.cib.com.cn/pers/main/pubinfo/ifxQuotationQuery/list?_search=false&dataSet.nd={timestamp}&dataSet.rows=80&dataSet.page=1&dataSet.sidx=&dataSet.sort=asc',
        'visit_business': True,
        'visit_api': True,
        'method': 'GET'
    },
    'cmb': {
        'code': 'cmb',
        'name': '招商银行',
        'url_business': 'https://fx.cmbchina.com/Hq/',
        'url_api': 'https://fx.cmbchina.com/api/v1/fx/rate',
        'visit_business': False,
        'visit_api': True,
        'method': 'GET'
    },
    'icbc': {
        'code': 'icbc',
        'name': '工商银行',
        'url_business': 'https://open.icbc.com.cn/icbc/apip/api_list.html#',
        'url_api': 'https://papi.icbc.com.cn/exchanges/ns/getLatest',
        'visit_business': False,
        'visit_api': True,
        'method': 'GET'
    },
    'abc': {
        'code': 'abc',
        'name': '农业银行',
        'url_business': 'https://app.abchina.com/static/app/ll/ExchangeRate/',
        'url_api': 'https://ewealth.abchina.com/app/data/api/DataService/ExchangeRateV2',
        'visit_business': False,
        'visit_api': True,
        'method': 'GET'
    },
    'psbc': {
        'code': 'psbc',
        'name': '中国邮政储蓄银行',
        'url_business': 'https://www.psbc.com/cn/common/bjfw/whpjcx/',
        'url_api': 'https://s.psbc.com/portal/PsbcService/foreignexchange/curr',
        'visit_business': False,
        'visit_api': True,
        'method': 'GET'
    },
    'ccb': {
        'code': 'ccb',
        'name': '中国建设银行',
        'url_business': 'https://ebank2.ccb.com/chn/forex/exchange-quotations.shtml',
        'url_api': 'https://www2.ccb.com/cn/home/news/jshckpj_new.xml',
        'visit_business': False,
        'visit_api': True,
        'method': 'GET'
    },
    'bocom': {
        'code': 'bocom',
        'name': '交通银行',
        'url_business': 'https://www.bankcomm.com/BankCommSite/zonghang/cn/newWhpj/foreignExchangeSearch_Cn.html',
        'url_api': 'https://www.bankcomm.com/BankCommSite/zh-cn/personal/forex/forexQuotation.html',
        'visit_business': True,
        'visit_api': False,
        'method': 'GET'
    },
    'boc': {
        'code': 'boc',
        'name': '中国银行',
        'url_business': 'https://www.boc.cn/sourcedb/whpj/index.html',
        'url_api': '',
        'visit_business': True,
        'visit_api': False,
        'method': 'GET'
    }
}

async def fetch_exchange_rate(bank_code, config):
    """
    使用 JavaScript fetch API 获取汇率数据
    """
    try:
        # 使用 Cloudflare Workers 的 fetch API
        headers = Headers.new({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        })
        
        # 根据银行配置决定访问哪个URL
        target_url = None
        if config.get('visit_api', False) and config.get('url_api'):
            # 优先使用API接口
            target_url = config['url_api']
            # 对于兴业银行，需要替换时间戳
            if bank_code == 'cib' and '{timestamp}' in target_url:
                timestamp = str(int(time.time() * 1000))  # 毫秒时间戳
                target_url = target_url.replace('{timestamp}', timestamp)
        elif config.get('visit_business', False) and config.get('url_business'):
            # 使用业务页面
            target_url = config['url_business']
        
        if not target_url:
            return {
                'bank': config['name'],
                'bank_code': bank_code,
                'error': '无可用的访问URL',
                'success': False
            }
        
        print(f"正在访问 {config['name']} API: {target_url}")
        
        response = await fetch(target_url, {
            'method': config['method'],
            'headers': headers
        })
        
        if response.ok:
            # 根据响应类型处理数据
            content_type = response.headers.get('content-type', '').lower()
            if 'application/json' in content_type:
                data = await response.json()
            elif 'text/xml' in content_type or 'application/xml' in content_type:
                data = await response.text()
            else:
                data = await response.text()
            
            return {
                'bank': config['name'],
                'bank_code': bank_code,
                'data': data,
                'timestamp': time.time(),
                'success': True,
                'url': target_url,
                'content_type': content_type
            }
        else:
            error_text = await response.text()
            return {
                'bank': config['name'],
                'bank_code': bank_code,
                'error': f'HTTP {response.status}: {error_text[:200]}',
                'success': False,
                'url': target_url
            }
    except Exception as e:
        return {
            'bank': config['name'],
            'bank_code': bank_code,
            'error': str(e),
            'success': False,
            'url': target_url if 'target_url' in locals() else 'unknown'
        }

async def save_to_r2(env, data, filename):
    """
    保存数据到 Cloudflare R2 对象存储
    """
    try:
        json_data = json.dumps(data, ensure_ascii=False, indent=2)
        await env.EXCHANGE_RATE_BUCKET.put(filename, json_data)
        return True
    except Exception as e:
        print(f"保存到R2失败: {e}")
        return False

async def save_to_kv(env, data):
    """
    保存最新数据到 Cloudflare KV
    """
    try:
        json_data = json.dumps(data, ensure_ascii=False)
        await env.EXCHANGE_RATE_KV.put("latest_rates", json_data)
        return True
    except Exception as e:
        print(f"保存到KV失败: {e}")
        return False

# Fetch Handler - 处理HTTP请求
async def on_fetch(request, env):
    """
    处理HTTP请求，返回最新汇率数据
    """
    try:
        # CORS头部配置
        cors_headers = {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400'
        }
        
        # 处理OPTIONS预检请求
        if request.method == 'OPTIONS':
            return Response.new('', {
                'headers': cors_headers
            })
        
        # 从KV获取最新数据
        latest_data = await env.EXCHANGE_RATE_KV.get("latest_rates")
        if latest_data:
            return Response.new(latest_data, {
                'headers': cors_headers
            })
        else:
            return Response.new(
                json.dumps({'error': '暂无汇率数据'}, ensure_ascii=False),
                {
                    'status': 404,
                    'headers': cors_headers
                }
            )
    except Exception as e:
        return Response.new(
            json.dumps({'error': str(e)}, ensure_ascii=False),
            {
                'status': 500,
                'headers': {'Content-Type': 'application/json; charset=utf-8'}
            }
        )

# Scheduled Handler - 处理定时任务
async def on_scheduled(controller, env, ctx):
    """
    定时执行汇率数据采集
    """
    print(f"开始执行定时汇率采集任务: {controller.cron}")
    print(f"支持的银行数量: {len(BANKS)} 个")
    
    results = []
    timestamp = time.strftime("%Y%m%d_%H%M%S", time.gmtime())
    
    # 遍历所有银行
    for i, (bank_code, config) in enumerate(BANKS.items(), 1):
        print(f"[{i}/{len(BANKS)}] 正在采集 {config['name']} 汇率数据...")
        result = await fetch_exchange_rate(bank_code, config)
        results.append(result)
        
        if result['success']:
            # 获取数据大小信息
            data_info = ""
            if isinstance(result.get('data'), dict):
                data_info = f" (JSON数据)"
            elif isinstance(result.get('data'), str):
                data_info = f" (文本数据: {len(result['data'])} 字符)"
            print(f"✅ {config['name']} 数据采集成功{data_info}")
        else:
            print(f"❌ {config['name']} 数据采集失败: {result.get('error', '未知错误')}")
    
    # 汇总数据
    successful_count = len([r for r in results if r['success']])
    failed_count = len([r for r in results if not r['success']])
    
    summary = {
        'timestamp': timestamp,
        'update_time': time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        'total_banks': len(BANKS),
        'successful_banks': successful_count,
        'failed_banks': failed_count,
        'success_rate': f"{(successful_count/len(BANKS)*100):.1f}%",
        'supported_banks': [config['name'] for config in BANKS.values()],
        'data': results
    }
    
    # 保存数据
    filename = f"exchange_rates_{timestamp}.json"
    
    # 保存到R2（历史记录）
    if hasattr(env, 'EXCHANGE_RATE_BUCKET'):
        r2_saved = await save_to_r2(env, summary, filename)
        if r2_saved:
            print(f"✅ 数据已保存到 R2: {filename}")
        else:
            print("❌ R2 保存失败")
    
    # 保存到KV（最新数据）
    if hasattr(env, 'EXCHANGE_RATE_KV'):
        kv_saved = await save_to_kv(env, summary)
        if kv_saved:
            print("✅ 最新数据已保存到 KV")
        else:
            print("❌ KV 保存失败")
    
    print(f"定时任务完成!")
    print(f"📊 执行统计: 成功 {summary['successful_banks']}/{summary['total_banks']} 个银行 (成功率: {summary['success_rate']})")
    print(f"📋 支持银行: {', '.join(summary['supported_banks'])}")
    
    # 显示失败的银行（如果有）
    failed_banks = [r for r in results if not r['success']]
    if failed_banks:
        print("❌ 失败银行详情:")
        for failed in failed_banks:
            print(f"   • {failed['bank']}: {failed.get('error', '未知错误')}")
    
    print("=" * 50) 