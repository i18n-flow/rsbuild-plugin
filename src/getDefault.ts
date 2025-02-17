import { type ObjectLiteralElementLike, Project, SyntaxKind } from 'ts-morph';

export function getExportDefaultFromAST(filePath: string): {
  [key: string]: string | number | boolean;
} | null {
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(filePath);
  const defaultExportSymbol = sourceFile.getDefaultExportSymbol();

  if (!defaultExportSymbol) {
    console.log('未找到 default 导出');
    return null;
  }

  const declaration = defaultExportSymbol.getDeclarations()[0];
  try {
    // export default 后面使用标准的 json 写法，直接 parse
    const exportDefault = declaration
      .getText()
      .replace(/^export\s+default\s+/, '');
    return JSON.parse(exportDefault);
  } catch (error) {}
  // export default 后面使用 js 对象声明的方式。尝试查找对象字面量表达式
  const objectLiteral = declaration.getFirstDescendantByKind(
    SyntaxKind.ObjectLiteralExpression,
  );
  if (!objectLiteral) {
    console.log('default 导出不是一个简单的对象字面量');
    return null;
  }

  // 将对象字面量转换为普通的 JS 对象
  const obj: {
    [key: string]: string | number | boolean;
  } = {};
  for (const prop of objectLiteral.getProperties()) {
    if (prop.getKind() === SyntaxKind.PropertyAssignment) {
      const assignment = prop.asKindOrThrow(SyntaxKind.PropertyAssignment);
      const name = assignment.getName();
      const initializer = assignment.getInitializer();
      if (!initializer) continue;
      switch (initializer.getKind()) {
        case SyntaxKind.StringLiteral:
          obj[name] = initializer.getText().slice(1, -1);
          break;
        case SyntaxKind.NumericLiteral:
          obj[name] = Number(initializer.getText());
          break;
        case SyntaxKind.TrueKeyword:
          obj[name] = true;
          break;
        case SyntaxKind.FalseKeyword:
          obj[name] = false;
          break;
        default:
          // 对于其他情况，这里仅返回文本（可能需要进一步处理）
          obj[name] = initializer.getText();
      }
    }
  }
  return obj;
}
