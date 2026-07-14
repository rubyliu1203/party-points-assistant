import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Table, Button, Modal, Form, Select, Input, InputNumber, Tag, Space, message, DatePicker } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { bonusApi } from '../api/bonus';
import { memberApi } from '../api/members';
import { BONUS_LEVELS } from '../utils/constants';

interface OutletContext {
  currentQuarter: { id: number; year: number; quarter: number } | null;
}

function BonusPage() {
  const { currentQuarter } = useOutletContext<OutletContext>();
  const [records, setRecords] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (currentQuarter?.id) {
      loadData();
      loadMembers();
    }
  }, [currentQuarter]);

  const loadData = async () => {
    if (!currentQuarter?.id) return;
    setLoading(true);
    try {
      const res: any = await bonusApi.getBonusRecords({ quarterId: currentQuarter.id });
      if (res.code === 200) {
        setRecords(res.data);
      }
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    try {
      const res: any = await memberApi.getMembers();
      if (res.code === 200) {
        setMembers(res.data);
      }
    } catch (error) {}
  };

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: any) => {
    setEditingRecord(record);
    form.setFieldsValue({
      partyMemberId: record.partyMemberId,
      level: record.level,
      score: record.score,
      source: record.source,
      description: record.description,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const res: any = await bonusApi.deleteBonusRecord(id);
      if (res.code === 200) {
        message.success('删除成功');
        loadData();
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async (values: any) => {
    if (!currentQuarter?.id) return;
    try {
      const data = {
        ...values,
        quarterId: currentQuarter.id,
      };

      if (editingRecord) {
        const res: any = await bonusApi.updateBonusRecord(editingRecord.id, data);
        if (res.code === 200) message.success('更新成功');
      } else {
        const res: any = await bonusApi.createBonusRecord(data);
        if (res.code === 200) message.success('创建成功');
      }

      setModalVisible(false);
      loadData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: '序号', width: 60, render: (_: any, __: any, index: number) => index + 1 },
    { title: '党员姓名', dataIndex: ['partyMember', 'name'], width: 100 },
    {
      title: '荣誉级别',
      dataIndex: 'level',
      width: 200,
      render: (level: number) => {
        const config = BONUS_LEVELS.find(b => b.value === level);
        return config ? `${config.label} (+${config.score}分)` : level;
      },
    },
    { title: '分值', dataIndex: 'score', width: 80, align: 'center' as const },
    { title: '荣誉来源', dataIndex: 'source', width: 150 },
    { title: '备注', dataIndex: 'description', width: 300, ellipsis: true },
    {
      title: '操作',
      width: 150,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>加分台账</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增加分</Button>
      </div>

      <Table columns={columns} dataSource={records} rowKey="id" loading={loading} pagination={false} size="small" bordered />

      <Modal title={editingRecord ? '编辑加分' : '新增加分'} open={modalVisible} onOk={() => form.submit()} onCancel={() => setModalVisible(false)}>
        <Form 
          form={form} 
          layout="vertical" 
          onFinish={handleSubmit}
          onValuesChange={(changedValues) => {
            if (changedValues.level !== undefined) {
              const config = BONUS_LEVELS.find(b => b.value === changedValues.level);
              if (config) {
                form.setFieldsValue({ score: config.score });
              }
            }
          }}
        >
          <Form.Item name="partyMemberId" label="党员" rules={[{ required: true }]}>
            <Select placeholder="选择党员">
              {members.map(m => (
                <Select.Option key={m.id} value={m.id}>{m.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="level" label="荣誉级别" rules={[{ required: true }]}>
            <Select placeholder="选择级别">
              {BONUS_LEVELS.map(b => (
                <Select.Option key={b.value} value={b.value}>{b.label} (+{b.score}分)</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="score" label="分值" rules={[{ required: true }]}>
            <InputNumber min={0} max={10} style={{ width: '100%' }} disabled />
          </Form.Item>
          <Form.Item name="source" label="荣誉来源">
            <Input placeholder="如：省公司表彰" />
          </Form.Item>
          <Form.Item name="description" label="备注">
            <Input.TextArea rows={2} placeholder="可填写获奖详情、时间等" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default BonusPage;
