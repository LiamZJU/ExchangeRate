from js import Response, fetch, Headers
import json
import time

# 银行配置 - 简化版，只包含基础银行
BANKS = {
    'cmb': {
        'code': 'cmb',
        'name': '招商银行',
        'url_api': 'https://fx.cmbchina.com/api/v1/fx/rate',
        'method': 'GET'
    },
    'icbc': {
        'code': 'icbc',
        'name': '工商银行',
        'url_api': 'https://papi.icbc.com.cn/exchanges/ns/getLatest',
        'method': 'GET'
    }
}

# 内存存储（临时）
latest_data = None

async def fetch_exchange_rate(bank_code, config):
    """获取单个银行的汇率数据"""
    try:
        headers = Headers.new({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        })
        
        print(f"正在访问 {config['name']} API: {config['url_api']}")
        
        response = await fetch(config['url_api'], {
            'method': config['method'],
            'headers': headers
        })
        
        if response.ok:
            data = await response.json()
            return {
                'bank': config['name'],
                'bank_code': bank_code,
                'data': data,
                'timestamp': time.time(),
                'success': True
            }
        else:
            error_text = await response.text()
            return {
                'bank': config['name'],
                'bank_code': bank_code,
                'error': f'HTTP {response.status}: {error_text[:200]}',
                'success': False
            }
    except Exception as e:
        return {
            'bank': config['name'],
            'bank_code': bank_code,
            'error': str(e),
            'success': False
        }

# Fetch Handler - 处理HTTP请求
async def on_fetch(request, env):
    """处理HTTP请求，返回最新汇率数据"""
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
        
        # 返回最新数据或默认消息
        if latest_data:
            return Response.new(json.dumps(latest_data, ensure_ascii=False), {
                'headers': cors_headers
            })
        else:
            # 如果没有缓存数据，立即获取一次
            print("没有缓存数据，立即获取汇率...")
            results = []
            for bank_code, config in BANKS.items():
                result = await fetch_exchange_rate(bank_code, config)
                results.append(result)
            
            response_data = {
                'timestamp': time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
                'total_banks': len(BANKS),
                'message': '实时汇率数据',
                'data': results
            }
            
            return Response.new(json.dumps(response_data, ensure_ascii=False), {
                'headers': cors_headers
            })
            
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
    """定时执行汇率数据采集"""
    global latest_data
    
    print(f"开始执行定时汇率采集任务: {controller.cron}")
    print(f"支持的银行数量: {len(BANKS)} 个")
    
    results = []
    
    # 遍历所有银行
    for i, (bank_code, config) in enumerate(BANKS.items(), 1):
        print(f"[{i}/{len(BANKS)}] 正在采集 {config['name']} 汇率数据...")
        result = await fetch_exchange_rate(bank_code, config)
        results.append(result)
        
        if result['success']:
            print(f"✅ {config['name']} 数据采集成功")
        else:
            print(f"❌ {config['name']} 数据采集失败: {result.get('error', '未知错误')}")
    
    # 汇总数据
    successful_count = len([r for r in results if r['success']])
    
    summary = {
        'timestamp': time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        'total_banks': len(BANKS),
        'successful_banks': successful_count,
        'success_rate': f"{(successful_count/len(BANKS)*100):.1f}%",
        'data': results
    }
    
    # 更新内存缓存
    latest_data = summary
    
    print(f"定时任务完成! 成功率: {summary['success_rate']}")
    print("=" * 50) 