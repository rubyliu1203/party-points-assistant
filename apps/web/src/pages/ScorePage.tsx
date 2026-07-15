import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Table, Button, Modal, Form, Select, Tag, Space, message, Tooltip
} from 'antd';
import { ReloadOutlined, EditOutlined, FileExcelOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { scoreApi } from '../api/scores';
import type { PartyMemberScore } from '../api/scores';

import { PERFORMANCE_LEVELS } from '../utils/constants';

interface OutletContext {
  currentQuarter: { id: number; year: number; quarter: number } | null;
}

function ScorePage() {
  const { currentQuarter } = useOutletContext<OutletContext>();
  const [scores, setScores] = useState<PartyMemberScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingScore, setEditingScore] = useState<PartyMemberScore | null>(null);
  const [form] = Form.useForm();
  const [showPerformance, setShowPerformance] = useState(true);

  useEffect(() => {
    if (currentQuarter?.id) {
      loadScores();
    }
  }, [currentQuarter]);

  const loadScores = async () => {
    if (!currentQuarter?.id) return;
    setLoading(true);
    try {
      const res: any = await scoreApi.getScores(currentQuarter.id);
      if (res.code === 200) {
        setScores(res.data);
      }
    } catch (error) {
      message.error('加载积分台账失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    if (!currentQuarter?.id) return;
    try {
      const res: any = await scoreApi.recalculateScores(currentQuarter.id);
      if (res.code === 200) {
        message.success(`已重新计算 ${res.data.updated} 人的积分`);
        loadScores();
      }
    } catch (error) {
      message.error('重新计算失败');
    }
  };

  const handleEditPerformance = (score: PartyMemberScore) => {
    setEditingScore(score);
    form.setFieldsValue({
      performanceLevel: score.performanceLevel,
    });
    setModalVisible(true);
  };

  const handleExport = (type: 'score' | 'public') => {
    if (!currentQuarter?.id) {
      message.warning('请先选择季度');
      return;
    }
    
    const url = type === 'public'
      ? `/api/v1/reports/public-score?quarterId=${currentQuarter.id}`
      : `/api/v1/reports/score-summary?quarterId=${currentQuarter.id}`;
    
    const link = document.createElement('a');
    link.href = url;
    link.download = type === 'public' ? '党员积分公示版.xlsx' : '党员积分总台账.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async (values: any) => {
    if (!editingScore || !currentQuarter?.id) return;
    try {
      const res: any = await scoreApi.updatePerformance(
        editingScore.partyMemberId,
        currentQuarter.id,
        values.performanceLevel
      );
      if (res.code === 200) {
        message.success('更新成功');
        setModalVisible(false);
        loadScores();
      }
    } catch (error) {
      message.error('更新失败');
    }
  };

  const getVetoTag = (status: string) => {
    switch (status) {
      case 'light':
        return <Tag color="orange">轻度否决</Tag>;
      case 'severe':
        return <Tag color="red">严重否决</Tag>;
      default:
        return <Tag color="green">无</Tag>;
    }
  };

  const columns = [
    { title: '序号', width: 60, render: (_: any, __: any, index: number) => index + 1 },
    {
      title: '党员姓名',
      width: 100,
      render: (_: any, record: PartyMemberScore) => record.partyMember.name,
    },
    {
      title: '基础分',
      children: [
        { title: '政治合格', dataIndex: 'politicalScore', width: 90, align: 'center' as const },
        { title: '执行纪律', dataIndex: 'disciplineScore', width: 90, align: 'center' as const },
        { title: '品德合格', dataIndex: 'moralityScore', width: 90, align: 'center' as const },
      ],
    },
    {
      title: '履职分',
      children: [
        ...(showPerformance ? [
          {
            title: '绩效等级',
            width: 100,
            align: 'center' as const,
            render: (_: any, record: PartyMemberScore) => (
              <Space>
                <span>{record.performanceLevel || '-'}</span>
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => handleEditPerformance(record)}
                />
              </Space>
            ),
          },
          {
            title: '绩效得分',
            dataIndex: 'performanceScore',
            width: 90,
            align: 'center' as const,
            render: (v: number | null) => v ?? '-',
          },
        ] : []),
        {
          title: '发挥作用',
          dataIndex: 'roleScore',
          width: 90,
          align: 'center' as const,
          render: (v: number | null) => v ?? '-',
        },
      ],
    },
    {
      title: '加分项',
      dataIndex: 'bonusScore',
      width: 80,
      align: 'center' as const,
      render: (v: number) => v > 0 ? <Tag color="green">+{v}</Tag> : '-',
    },
    {
      title: '扣分项',
      dataIndex: 'deductionScore',
      width: 80,
      align: 'center' as const,
      render: (v: number) => v > 0 ? <Tag color="red">-{v}</Tag> : '-',
    },
    {
      title: '一票否决',
      dataIndex: 'vetoStatus',
      width: 100,
      align: 'center' as const,
      render: (v: string) => getVetoTag(v),
    },
    {
      title: '总分',
      dataIndex: 'totalScore',
      width: 80,
      align: 'center' as const,
      render: (v: number | null) => (
        <strong style={{ color: '#cf1322', fontSize: 16 }}>
          {v ?? '-'}
        </strong>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>
          党员积分台账
          {currentQuarter && (
            <span style={{ fontSize: 16, color: '#999', marginLeft: 12 }}>
              {currentQuarter.year}年 Q{currentQuarter.quarter}
            </span>
          )}
        </h2>
        <Space>
          <Tooltip title="重新计算积分">
            <Button icon={<ReloadOutlined />} onClick={handleRecalculate}>
              重新计算
            </Button>
          </Tooltip>
          <Tooltip title={showPerformance ? '隐藏绩效列' : '显示绩效列'}>
            <Button
              icon={showPerformance ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              onClick={() => setShowPerformance(!showPerformance)}
            >
              {showPerformance ? '隐藏绩效' : '显示绩效'}
            </Button>
          </Tooltip>
          <Button
            type="primary"
            icon={<FileExcelOutlined />}
            onClick={() => handleExport('score')}
          >
            导出Excel
          </Button>
          <Button
            icon={<FileExcelOutlined />}
            onClick={() => handleExport('public')}
          >
            导出公示版
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={scores}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
        bordered
        scroll={{ x: 1200 }}
      />

      <Modal
        title={`编辑绩效 - ${editingScore?.partyMember.name}`}
        open={modalVisible}
        onOk={() => form.submit()}
        onCancel={() => setModalVisible(false)}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="performanceLevel"
            label="季度绩效等级"
            rules={[{ required: true, message: '请选择绩效等级' }]}
          >
            <Select placeholder="选择绩效等级">
              {Object.entries(PERFORMANCE_LEVELS).map(([level, score]) => (
                <Select.Option key={level} value={level}>
                  {level} ({score}分)
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default ScorePage;
