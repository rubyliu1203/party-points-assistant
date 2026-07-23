import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Table, Tag, Spin, Alert, Typography, Divider } from 'antd';

const { Title, Text } = Typography;

interface MemberResult {
  index: number;
  member: any;
  quarterBaseScore: number;
  quarterBaseBonus: number;
  quarterTaskBonus: number;
  quarterDeduction: number;
  quarterTotal: number;
  totalBonus: number;
  normalizedScore: number;
}

interface QuarterInfo {
  id: number;
  year: number;
  quarter: number;
  startDate: string;
  endDate: string;
}

interface BonusDetail {
  id: number;
  partyMemberId: number;
  year: number;
  month: number;
  type: string;
  content: string | null;
  score: number;
  partyMember?: any;
}

function ShareWorkScorePage() {
  const [searchParams] = useSearchParams();
  const quarterId = searchParams.get('quarterId');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quarter, setQuarter] = useState<QuarterInfo | null>(null);
  const [results, setResults] = useState<MemberResult[]>([]);
  const [bonusDetails, setBonusDetails] = useState<BonusDetail[]>([]);

  useEffect(() => {
    if (quarterId) {
      loadData();
    } else {
      setError('缺少 quarterId 参数');
      setLoading(false);
    }
  }, [quarterId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/public/work-scores/${quarterId}`);
      const data = await res.json();
      if (data.code === 200) {
        setQuarter(data.data.quarter);
        setResults(data.data.results);
        setBonusDetails(data.data.bonusDetails || []);
      } else {
        setError(data.message || '加载失败');
      }
    } catch (e: any) {
      setError('网络错误，请检查后端服务是否启动');
    } finally {
      setLoading(false);
    }
  };

  const getPositionsText = (member: any) => {
    const positions = JSON.parse(member.partyPositions || '[]');
    const parts: string[] = [];
    if (positions.length > 0) parts.push(positions.join(','));
    if (member.isPartyWorker) parts.push('党务工作者');
    return parts.length > 0 ? parts.join('、') : '-';
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40 }}>
        <Alert type="error" message={error} />
      </div>
    );
  }

  const summaryColumns = [
    { title: '序号', dataIndex: 'index', width: 60, align: 'center' as const },
    { title: '党员姓名', render: (r: MemberResult) => r.member.name, width: 100 },
    {
      title: '党内职务',
      width: 140,
      render: (r: MemberResult) => getPositionsText(r.member)
    },
    { title: '季度基础分', dataIndex: 'quarterBaseScore', width: 100, align: 'center' as const },
    { title: '季度基础加分', dataIndex: 'quarterBaseBonus', width: 100, align: 'center' as const },
    { title: '季度任务加分', dataIndex: 'quarterTaskBonus', width: 100, align: 'center' as const },
    { title: '季度扣分', dataIndex: 'quarterDeduction', width: 80, align: 'center' as const },
    {
      title: '季度小计',
      dataIndex: 'quarterTotal',
      width: 90,
      align: 'center' as const,
      render: (v: number) => <strong style={{ color: '#1890ff' }}>{v}</strong>
    },
    { title: '累计加分', dataIndex: 'totalBonus', width: 80, align: 'center' as const },
    {
      title: '归一化5分',
      dataIndex: 'normalizedScore',
      width: 90,
      align: 'center' as const,
      render: (v: number) => <Tag color="blue">{v}</Tag>
    },
  ];

  const detailColumns = [
    {
      title: '姓名',
      width: 100,
      render: (d: BonusDetail) => {
        const member = results.find(r => r.member.id === d.partyMemberId)?.member;
        return member?.name || '-';
      }
    },
    {
      title: '年月',
      width: 100,
      render: (d: BonusDetail) => `${d.year}年${d.month}月`
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 120
    },
    {
      title: '分值',
      dataIndex: 'score',
      width: 80,
      align: 'center' as const,
      render: (v: number) => <Tag color="green">+{v}</Tag>
    },
    {
      title: '内容',
      dataIndex: 'content',
      width: 300,
      render: (v: string | null) => v || '-'
    },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, color: '#cf1322' }}>
          产品研发部党支部 党务积分公示
        </Title>
        {quarter && (
          <Text type="secondary" style={{ fontSize: 16 }}>
            {quarter.year}年 第{quarter.quarter}季度（{quarter.startDate.slice(0, 10)} ~ {quarter.endDate.slice(0, 10)}）
          </Text>
        )}
      </div>

      <Alert
        type="info"
        showIcon={false}
        message="本页面为公开分享页面，仅展示当前季度的党务积分汇总和加分明细，数据为只读。"
        style={{ marginBottom: 16 }}
      />

      <Divider>
        <strong>季度汇总</strong>
      </Divider>

      <Table
        columns={summaryColumns}
        dataSource={results}
        rowKey={(r) => `summary-${r.member.id}`}
        pagination={false}
        size="small"
        bordered
        scroll={{ x: 900 }}
      />

      <div style={{ marginTop: 8, fontSize: 12, color: '#666', textAlign: 'right' }}>
        全员基础分95分；支委基础加分+5分，党务工作者基础加分+3分（每季度首月）；
        任务加分含分享心得（+0.5分/次）及其他党务任务；
        归一化5分 = 累计加分 / 最高累计加分 × 5
      </div>

      {bonusDetails.length > 0 && (
        <>
          <Divider style={{ marginTop: 24 }}>
            <strong>加分明细</strong>
          </Divider>

          <Table
            columns={detailColumns}
            dataSource={bonusDetails}
            rowKey="id"
            pagination={false}
            size="small"
            bordered
            scroll={{ x: 700 }}
          />
        </>
      )}

      <div style={{ marginTop: 32, textAlign: 'center', color: '#999', fontSize: 12 }}>
        产品研发部党支部 · 党员党务积分助手
      </div>
    </div>
  );
}

export default ShareWorkScorePage;
