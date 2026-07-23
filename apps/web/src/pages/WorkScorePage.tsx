import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Table, Button, Tabs, Tag, Space, Modal, Form, Select, Input, InputNumber,
  message, Popconfirm, Checkbox, Card, Divider, Row, Col, Tooltip
} from 'antd';
import {
  FileExcelOutlined, PlusOutlined, ReloadOutlined, DeleteOutlined,
  DownOutlined, UpOutlined, CheckCircleOutlined, ShareAltOutlined
} from '@ant-design/icons';
import { workScoreApi } from '../api/workScores';
import { memberApi } from '../api/members';

interface OutletContext {
  currentQuarter: { id: number; year: number; quarter: number } | null;
  isArchived: boolean;
}

interface MemberMonthly {
  member: any;
  months: Record<number, any>;
  quarterTotal: number;
}

function WorkScorePage() {
  const { currentQuarter, isArchived } = useOutletContext<OutletContext>();
  const [activeTab, setActiveTab] = useState('summary');
  const [summaryData, setSummaryData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<MemberMonthly[]>([]);
  const [detailData, setDetailData] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 弹窗状态
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [addForm] = Form.useForm();
  const [batchForm] = Form.useForm();

  // 预填数据
  const [preMemberId, setPreMemberId] = useState<number | null>(null);
  const [preMonth, setPreMonth] = useState<number | null>(null);

  // 展开行
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (currentQuarter?.id) {
      loadData();
      loadMembers();
    }
  }, [currentQuarter]);

  const loadMembers = async () => {
    try {
      const res: any = await memberApi.getMembers();
      if (res.code === 200) {
        setMembers(res.data.filter((m: any) => m.status === 'active'));
      }
    } catch (error) {
      console.error('加载党员失败');
    }
  };

  const loadData = async () => {
    if (!currentQuarter?.id) return;
    setLoading(true);
    try {
      const [summaryRes, monthlyRes, detailRes]: any = await Promise.all([
        workScoreApi.getWorkScoreSummary(currentQuarter.id),
        workScoreApi.getWorkScores({ quarterId: currentQuarter.id }),
        workScoreApi.getWorkScoreDetails({ quarterId: currentQuarter.id })
      ]);

      if (summaryRes.code === 200) {
        setSummaryData(summaryRes.data.results);
      }

      if (monthlyRes.code === 200) {
        // 按人员分组
        const grouped = groupByMember(monthlyRes.data, summaryRes.data?.results || []);
        setMonthlyData(grouped);
      }

      if (detailRes.code === 200) {
        setDetailData(detailRes.data);
      }
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const groupByMember = (scores: any[], summaries: any[]): MemberMonthly[] => {
    const memberMap = new Map<number, any>();
    const monthsMap = new Map<number, Record<number, any>>();

    scores.forEach((s: any) => {
      if (!monthsMap.has(s.partyMemberId)) {
        monthsMap.set(s.partyMemberId, {});
      }
      monthsMap.get(s.partyMemberId)![s.month] = s;
      memberMap.set(s.partyMemberId, s.partyMember);
    });

    const result: MemberMonthly[] = [];
    memberMap.forEach((member, id) => {
      const summary = summaries.find((s: any) => s.member.id === id);
      result.push({
        member,
        months: monthsMap.get(id) || {},
        quarterTotal: summary?.quarterTotal || 95
      });
    });

    // 按displayOrder排序
    result.sort((a, b) => (a.member.displayOrder || 0) - (b.member.displayOrder || 0));
    return result;
  };

  const getQuarterMonths = () => {
    if (!currentQuarter) return [];
    const map: Record<number, number[]> = {
      1: [1, 2, 3], 2: [4, 5, 6], 3: [7, 8, 9], 4: [10, 11, 12]
    };
    return map[currentQuarter.quarter] || [];
  };

  const handleRecalculate = async () => {
    if (!currentQuarter?.id) return;
    try {
      setLoading(true);
      const res: any = await workScoreApi.recalculateBaseBonus(currentQuarter.id);
      if (res.code === 200) {
        message.success(res.message);
        loadData();
      }
    } catch (error) {
      message.error('重新计算失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDetail = async (values: any) => {
    if (!currentQuarter?.id) return;
    try {
      const data = {
        partyMemberId: values.partyMemberId,
        quarterId: currentQuarter.id,
        year: currentQuarter.year,
        month: values.month,
        type: values.type,
        content: values.content,
        score: values.score
      };
      const res: any = await workScoreApi.createWorkScoreDetail(data);
      if (res.code === 200) {
        message.success('添加成功');
        // 连续添加模式：保留人员和月份，清空其他字段
        addForm.setFieldsValue({
          partyMemberId: values.partyMemberId,
          month: values.month,
          type: undefined,
          score: 0.5,
          content: undefined
        });
        loadData();
      }
    } catch (error) {
      message.error('添加失败');
    }
  };

  const handleBatchAdd = async (values: any) => {
    if (!currentQuarter?.id) return;
    try {
      const memberIds: number[] = values.memberIds;
      let successCount = 0;

      for (const memberId of memberIds) {
        const data = {
          partyMemberId: memberId,
          quarterId: currentQuarter.id,
          year: currentQuarter.year,
          month: values.month,
          type: values.type,
          content: values.content,
          score: values.score
        };
        try {
          const res: any = await workScoreApi.createWorkScoreDetail(data);
          if (res.code === 200) successCount++;
        } catch (e) {
          console.error(`添加失败: memberId=${memberId}`);
        }
      }

      message.success(`成功为 ${successCount}/${memberIds.length} 人添加加分`);
      setBatchModalVisible(false);
      batchForm.resetFields();
      loadData();
    } catch (error) {
      message.error('批量添加失败');
    }
  };

  const handleDeleteDetail = async (id: number) => {
    try {
      const res: any = await workScoreApi.deleteWorkScoreDetail(id);
      if (res.code === 200) {
        message.success('删除成功');
        loadData();
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const openAddModal = (memberId: number, month: number) => {
    setPreMemberId(memberId);
    setPreMonth(month);
    addForm.setFieldsValue({
      partyMemberId: memberId,
      month: month,
      type: '分享心得',
      score: 0.5,
      content: ''
    });
    setAddModalVisible(true);
  };

  const toggleExpand = (memberId: number) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(memberId)) {
      newSet.delete(memberId);
    } else {
      newSet.add(memberId);
    }
    setExpandedRows(newSet);
  };

  const getMemberDetails = (memberId: number, month: number) => {
    return detailData.filter(d => d.partyMemberId === memberId && d.month === month);
  };

  const getPositionsText = (member: any) => {
    const positions = JSON.parse(member.partyPositions || '[]');
    const parts: string[] = [];
    if (positions.length > 0) parts.push(positions.join(','));
    if (member.isPartyWorker) parts.push('党务工作者');
    return parts.length > 0 ? parts.join('、') : '-';
  };

  // ===== 月度汇总表格列 =====
  const months = getQuarterMonths();

  const monthlyColumns = [
    {
      title: '序号',
      width: 50,
      render: (_: any, __: any, index: number) => index + 1
    },
    {
      title: '党员姓名',
      width: 90,
      render: (record: MemberMonthly) => (
        <div>
          <strong>{record.member.name}</strong>
          <div style={{ fontSize: 12, color: '#999' }}>{getPositionsText(record.member)}</div>
        </div>
      )
    },
    ...months.map(month => ({
      title: `${currentQuarter?.year}年${month}月`,
      width: 160,
      align: 'center' as const,
      render: (record: MemberMonthly) => {
        const m = record.months[month];
        if (!m) return '-';
        const details = getMemberDetails(record.member.id, month);
        return (
          <div style={{ position: 'relative', padding: '4px 0' }}>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: '#1890ff' }}>
              {m.monthlyTotal}
            </div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
              {m.baseBonus > 0 && <span style={{ color: '#52c41a' }}>+{m.baseBonus} </span>}
              {m.taskBonus > 0 && <span style={{ color: '#1890ff' }}>+{m.taskBonus} </span>}
              {m.deduction > 0 && <span style={{ color: '#ff4d4f' }}>-{m.deduction}</span>}
              {m.baseBonus === 0 && m.taskBonus === 0 && m.deduction === 0 && <span style={{ color: '#ccc' }}>无变动</span>}
            </div>
            {details.length > 0 && (
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                {details.length}项加分
              </div>
            )}
            <Button
              size="small"
              type="link"
              icon={<PlusOutlined />}
              style={{ position: 'absolute', top: 0, right: -8, padding: 0 }}
              onClick={(e) => {
                e.stopPropagation();
                openAddModal(record.member.id, month);
              }}
              disabled={isArchived}
            />
          </div>
        );
      }
    })),
    {
      title: '季度小计',
      width: 90,
      align: 'center' as const,
      render: (record: MemberMonthly) => (
        <strong style={{ fontSize: 16, color: '#1890ff' }}>{record.quarterTotal}</strong>
      )
    },
    {
      title: '操作',
      width: 80,
      align: 'center' as const,
      render: (record: MemberMonthly) => (
        <Button
          size="small"
          type="link"
          icon={expandedRows.has(record.member.id) ? <UpOutlined /> : <DownOutlined />}
          onClick={() => toggleExpand(record.member.id)}
        >
          {expandedRows.has(record.member.id) ? '收起' : '展开'}
        </Button>
      )
    }
  ];

  // ===== 展开内容：每月明细 =====
  const expandedRowRender = (record: MemberMonthly) => {
    return (
      <div style={{ padding: '8px 16px', background: '#fafafa' }}>
        <Row gutter={16}>
          {months.map(month => {
            const m = record.months[month];
            const details = getMemberDetails(record.member.id, month);
            return (
              <Col span={8} key={month}>
                <Card
                  size="small"
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{currentQuarter?.year}年{month}月</span>
                      <Button
                        size="small"
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => openAddModal(record.member.id, month)}
                        disabled={isArchived}
                      >
                        加分
                      </Button>
                    </div>
                  }
                  style={{ marginBottom: 8 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span>基础分: <strong>95</strong></span>
                    <span>基础加分: <Tag color="blue">+{m?.baseBonus || 0}</Tag></span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span>任务加分: <Tag color="green">+{m?.taskBonus || 0}</Tag></span>
                    <span>扣分: <Tag color="red">-{m?.deduction || 0}</Tag></span>
                  </div>
                  <Divider style={{ margin: '8px 0' }} />
                  <div style={{ fontWeight: 'bold', textAlign: 'right', fontSize: 14 }}>
                    月度小计: {m?.monthlyTotal || 95}
                  </div>

                  {details.length > 0 && (
                    <>
                      <Divider style={{ margin: '8px 0' }} />
                      <div style={{ fontSize: 12 }}>
                        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>加分明细：</div>
                        {details.map((d: any) => (
                          <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
                            <span>
                              <Tag>{d.type}</Tag>
                              <span style={{ color: '#1890ff' }}>+{d.score}</span>
                              {d.content && <span style={{ color: '#999', marginLeft: 4 }}>{d.content}</span>}
                            </span>
                            <Popconfirm title="删除这条加分？" onConfirm={() => handleDeleteDetail(d.id)}>
                              <Button size="small" type="link" danger icon={<DeleteOutlined />} style={{ padding: 0 }} disabled={isArchived} />
                            </Popconfirm>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </Card>
              </Col>
            );
          })}
        </Row>
      </div>
    );
  };

  // ===== 季度汇总列 =====
  const summaryColumns = [
    { title: '序号', width: 50, render: (_: any, __: any, index: number) => index + 1 },
    { title: '党员姓名', dataIndex: ['member', 'name'], width: 90 },
    {
      title: '党内职务',
      width: 140,
      render: (_: any, record: any) => getPositionsText(record.member)
    },
    { title: '季度基础分', dataIndex: 'quarterBaseScore', width: 90, align: 'center' as const },
    { title: '季度基础加分', dataIndex: 'quarterBaseBonus', width: 90, align: 'center' as const },
    { title: '季度任务加分', dataIndex: 'quarterTaskBonus', width: 90, align: 'center' as const },
    { title: '季度扣分', dataIndex: 'quarterDeduction', width: 80, align: 'center' as const },
    {
      title: '季度小计',
      dataIndex: 'quarterTotal',
      width: 90,
      align: 'center' as const,
      render: (v: number) => <strong style={{ color: '#1890ff' }}>{v}</strong>
    },
    { title: '累计加分', dataIndex: 'totalBonus', width: 80, align: 'center' as const },
    { title: '归一化5分', dataIndex: 'normalizedScore', width: 80, align: 'center' as const },
  ];

  // ===== 加分明细列 =====
  const detailColumns = [
    { title: '姓名', dataIndex: ['partyMember', 'name'], width: 90 },
    { title: '年月', render: (r: any) => `${r.year}年${r.month}月`, width: 110 },
    { title: '类型', dataIndex: 'type', width: 110 },
    { title: '分值', dataIndex: 'score', width: 70, align: 'center' as const },
    {
      title: '内容',
      dataIndex: 'content',
      width: 120,
      render: (text: string) => (
        <Tooltip title={text || '-'} placement="topLeft">
          <span style={{ display: 'inline-block', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {text || '-'}
          </span>
        </Tooltip>
      )
    },
    {
      title: '操作',
      width: 70,
      render: (_: any, record: any) => (
        <Popconfirm title="确认删除？" onConfirm={() => handleDeleteDetail(record.id)}>
          <Button size="small" type="link" danger icon={<DeleteOutlined />} disabled={isArchived}>删除</Button>
        </Popconfirm>
      )
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>
          党务积分
          {currentQuarter && (
            <span style={{ fontSize: 16, color: '#999', marginLeft: 12 }}>
              {currentQuarter.year}年 Q{currentQuarter.quarter}
            </span>
          )}
        </h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleRecalculate} loading={loading} size="small" disabled={isArchived}>
            重新计算基础加分
          </Button>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={() => {
              batchForm.resetFields();
              setBatchModalVisible(true);
            }}
            size="small"
            disabled={isArchived}
          >
            批量添加分享心得
          </Button>
          <Button
            icon={<FileExcelOutlined />}
            size="small"
            onClick={() => {
              if (!currentQuarter?.id) {
                message.warning('请先选择季度');
                return;
              }
              const url = `/api/v1/reports/work-score-summary?quarterId=${currentQuarter.id}`;
              const link = document.createElement('a');
              link.href = url;
              link.download = `党务积分季度汇总.xlsx`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
          >
            导出Excel
          </Button>
          <Button
            icon={<ShareAltOutlined />}
            size="small"
            onClick={() => {
              if (!currentQuarter?.id) {
                message.warning('请先选择季度');
                return;
              }
              const url = `/api/v1/public/work-scores/${currentQuarter.id}/export-html`;
              const link = document.createElement('a');
              link.href = url;
              link.download = `党务积分公示_${currentQuarter.year}年Q${currentQuarter.quarter}.html`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              message.success('公示HTML文件已开始下载，下载完成后双击即可打开');
            }}
          >
            导出公示页
          </Button>
        </Space>
      </div>

      <div style={{ marginBottom: 16, padding: 10, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4, fontSize: 13 }}>
        <strong>统计规则：</strong>
        全员基础分95分；支委基础加分+5分，党务工作者基础加分+3分（每季度首月）；
        任务加分 = 分享心得（+0.5分/次）+ 其他党务任务；
        月度小计 = 95 + 基础加分 + 任务加分 - 扣分；
        季度小计 = 95 + 季度基础加分 + 季度任务加分 - 季度扣分
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <Tabs.TabPane tab="月度汇总" key="monthly">
          <Table
            columns={monthlyColumns}
            dataSource={monthlyData}
            rowKey={(r) => r.member.id}
            loading={loading}
            pagination={false}
            size="small"
            bordered
            expandable={{
              expandedRowRender,
              expandedRowKeys: Array.from(expandedRows),
              onExpandedRowsChange: (keys: any) => setExpandedRows(new Set(keys)),
              expandIconColumnIndex: -1,
              expandIcon: () => null
            }}
          />
        </Tabs.TabPane>

        <Tabs.TabPane tab="季度汇总" key="summary">
          <Table
            columns={summaryColumns}
            dataSource={summaryData}
            rowKey={(r) => `summary-${r.member.id}`}
            loading={loading}
            pagination={false}
            size="small"
            bordered
          />
        </Tabs.TabPane>

        <Tabs.TabPane tab="加分明细" key="details">
          <Table
            columns={detailColumns}
            dataSource={detailData}
            rowKey="id"
            loading={loading}
            pagination={false}
            size="small"
            bordered
          />
        </Tabs.TabPane>
      </Tabs>

      {/* ===== 单条加分弹窗（连续添加模式） ===== */}
      <Modal
        title={`添加加分 - ${preMemberId ? members.find(m => m.id === preMemberId)?.name : ''} ${preMonth ? `${preMonth}月` : ''}`}
        open={addModalVisible}
        onOk={() => addForm.submit()}
        onCancel={() => setAddModalVisible(false)}
        width={480}
        okText="添加并继续"
        cancelText="关闭"
      >
        <Form form={addForm} layout="vertical" onFinish={handleAddDetail}>
          <Form.Item name="partyMemberId" label="党员" rules={[{ required: true }]}>
            <Select placeholder="选择党员" disabled={!!preMemberId}>
              {members.map(m => (
                <Select.Option key={m.id} value={m.id}>{m.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="month" label="月份" rules={[{ required: true }]}>
            <Select placeholder="选择月份" disabled={!!preMonth}>
              {months.map(m => (
                <Select.Option key={m} value={m}>{currentQuarter?.year}年{m}月</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="type" label="加分类型" rules={[{ required: true }]}>
            <Select placeholder="选择类型">
              <Select.Option value="分享心得">分享心得 (+0.5分)</Select.Option>
              <Select.Option value="其他任务">其他党务任务</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="score" label="分值" rules={[{ required: true }]} initialValue={0.5}>
            <InputNumber min={0} max={20} step={0.5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="content" label="加分内容">
            <Input placeholder="如：党纪学习教育心得体会" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ===== 批量添加弹窗 ===== */}
      <Modal
        title="批量添加分享心得"
        open={batchModalVisible}
        onOk={() => batchForm.submit()}
        onCancel={() => setBatchModalVisible(false)}
        width={600}
        okText="批量添加"
      >
        <Form form={batchForm} layout="vertical" onFinish={handleBatchAdd}>
          <Form.Item
            name="memberIds"
            label="选择党员（可多选）"
            rules={[{ required: true, message: '请至少选择一名党员' }]}
          >
            <Checkbox.Group style={{ width: '100%' }}>
              <Row gutter={[8, 8]}>
                {members.map(m => (
                  <Col span={6} key={m.id}>
                    <Checkbox value={m.id}>{m.name}</Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>
          <Form.Item name="month" label="月份" rules={[{ required: true }]} initialValue={months[0]}>
            <Select placeholder="选择月份">
              {months.map(m => (
                <Select.Option key={m} value={m}>{currentQuarter?.year}年{m}月</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="type" initialValue="分享心得" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="score" initialValue={0.5} hidden>
            <InputNumber />
          </Form.Item>
          <Form.Item name="content" label="内容（可选）">
            <Input placeholder="如：党纪学习教育心得体会" />
          </Form.Item>
          <div style={{ padding: 8, background: '#e6f7ff', borderRadius: 4, fontSize: 13 }}>
            <CheckCircleOutlined style={{ color: '#1890ff', marginRight: 4 }} />
            将为选中的党员统一添加 <strong>分享心得 +0.5分</strong>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

export default WorkScorePage;
