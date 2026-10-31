import { Action, ActionPanel, Form, Icon, Toast, open, showToast, useNavigation } from "@raycast/api";
import { useEffect, useState } from "react";
import { createAirSheet } from "./api/airsheet";
import { fileUrl } from "./api/files";
import { searchDoclibs } from "./api/doclibs";
import { WpsDoclib } from "./api/types";

interface FormValues {
  name: string;
  driveId: string;
}

export default function Command() {
  const { pop } = useNavigation();
  const [doclibs, setDoclibs] = useState<WpsDoclib[]>([]);
  const [nameError, setNameError] = useState<string | undefined>();

  useEffect(() => {
    void (async () => {
      try {
        setDoclibs(await searchDoclibs(""));
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "获取文档库列表失败",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  }, []);

  async function handleSubmit(values: FormValues) {
    const name = values.name.trim();
    if (!name) {
      setNameError("文件名不能为空");
      return;
    }
    if (name.length > 255) {
      setNameError("文件名过长（最多 255 字符）");
      return;
    }
    setNameError(undefined);

    try {
      const file = await createAirSheet({ driveId: values.driveId, name });
      const url = fileUrl(file);
      await showToast({ style: Toast.Style.Success, title: "已创建", message: file.name });
      if (url) await open(url);
      pop();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "创建失败",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return (
    <Form
      navigationTitle="创建智能表格"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="创建" icon={Icon.Plus} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="文件名"
        placeholder="例如：Q4 项目排期"
        error={nameError}
        onChange={() => setNameError(undefined)}
      />
      <Form.Dropdown id="driveId" title="目标空间" defaultValue={doclibs[0]?.drive_id} storeValue>
        {doclibs.map((doclib) => (
          <Form.Dropdown.Item key={doclib.drive_id} value={doclib.drive_id} title={doclib.name} />
        ))}
      </Form.Dropdown>
      <Form.Description text="第一版支持创建智能表格（.ksheet）；智能文档创建将在后续版本支持。" />
    </Form>
  );
}
