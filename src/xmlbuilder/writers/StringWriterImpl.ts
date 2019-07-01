import {
  WriterOptions, BuilderOptions, PreSerializedNode, 
  PreSerializedNS, PreSerializedAttr
} from "../interfaces"
import {
  Node, XMLDocument, Element, DocumentType, Text, CDATASection,
  Comment, ProcessingInstruction, DocumentFragment, NodeType
} from "../../dom/interfaces"
import { PreSerializer, Char } from "../util"
import { applyDefaults } from "../../util"

/**
 * Represents string writer options.
 */
interface StringWriterOptions {
  headless: boolean
  prettyPrint: boolean
  indent: string
  newline: string
  offset: number
  width: number
  allowEmptyTags: boolean
  dontPrettyPrintTextNodes: boolean
  spaceBeforeSlash: boolean
  noDoubleEncoding: boolean
}

/**
 * Represents reference parameters passed to string writer functions.
 */
interface StringWriterRefs {
  /**
   * Suppresses pretty-printing
   */
  suppressPrettyCount: number
}

/**
 * Serializes XML nodes into strings.
 */
export class StringWriterImpl {

  private _builderOptions: BuilderOptions

  /**
   * Initializes a new instance of `StringWriterImpl`.
   * 
   * @param builderOptions - XML builder options
   */
  constructor(builderOptions: BuilderOptions) {
    this._builderOptions = builderOptions
  }

  /**
   * Produces an XML serialization of the given node.
   * 
   * @param node - node to serialize
   * @param writerOptions - serialization options
   */
  serialize(node: Node, writerOptions?: WriterOptions): string {
    // provide default options
    const options: StringWriterOptions = applyDefaults(writerOptions, {
      headless: false,
      prettyPrint: false,
      indent: '  ',
      newline: '\n',
      offset: 0,
      width: 80,
      allowEmptyTags: false,
      dontPrettyPrintTextNodes: false,
      spaceBeforeSlash: false,
      noDoubleEncoding: false
    })

    let markup =  this._serializeNode(PreSerializer.Serialize(node), options,
      { suppressPrettyCount: 0 })

    // remove trailing newline
    if (options.prettyPrint && markup.slice(-options.newline.length) === options.newline) {
        markup = markup.slice(0, -options.newline.length)
    }
    
    return markup
  }

  /**
   * Produces an XML serialization of the given node.
   * 
   * @param preNode - current node
   * @param options - serialization options
   * @param refs - reference parameters
   */
  private _serializeNode(preNode: PreSerializedNode<Node>,
    options: StringWriterOptions, refs: StringWriterRefs): string {
    const isRaw = (<any><unknown>preNode.node).isRawNode

    if (isRaw) {
      return this._serializeRaw(<PreSerializedNode<Text>>preNode, options, refs)
    }

    switch (preNode.node.nodeType) {
      case NodeType.Element:
        return this._serializeElement(<PreSerializedNode<Element>>preNode, options, refs)
      case NodeType.Document:
        return this._serializeDocument(<PreSerializedNode<XMLDocument>>preNode, options, refs)
      case NodeType.Comment:
        return this._serializeComment(<PreSerializedNode<Comment>>preNode, options, refs)
      case NodeType.Text:
        return this._serializeText(<PreSerializedNode<Text>>preNode, options, refs)
      case NodeType.DocumentFragment:
        return this._serializeDocumentFragment(<PreSerializedNode<DocumentFragment>>preNode, options, refs)
      case NodeType.DocumentType:
        return this._serializeDocumentType(<PreSerializedNode<DocumentType>>preNode, options, refs)
      case NodeType.ProcessingInstruction:
        return this._serializeProcessingInstruction(<PreSerializedNode<ProcessingInstruction>>preNode, options, refs)
      case NodeType.CData:
        return this._serializeCdata(<PreSerializedNode<CDATASection>>preNode, options, refs)
      default:
        throw new Error("Invalid node type.")
    }
  }

  /**
   * Produces an XML serialization of the given node's children.
   * 
   * @param preNode - current node
   * @param options - serialization options
   * @param refs - reference parameters
   */
  private _serializeChildNodes(preNode: PreSerializedNode<Node>,
    options: StringWriterOptions, refs: StringWriterRefs): string {
    let markup = ''
    for (const child of preNode.children) {
      markup += this._serializeNode(child, options, refs)
    }
    return markup
  }

  /**
   * Produces an XML serialization of the given node's attributes.
   * 
   * @param preNode - current node
   * @param options - serialization options
   * @param refs - reference parameters
   */
  private _serializeAttributes(preNode: PreSerializedNode<Node>,
    options: StringWriterOptions, refs: StringWriterRefs): string {
    let markup = ''
    for (const preAttr of preNode.attributes) {
      markup += ` ${this._serializeAttribute(preAttr, options, refs)}`
    }
    return markup
  }

  /**
   * Produces an XML serialization of the given node's namespace declarations.
   * 
   * @param preNode - current node
   * @param options - serialization options
   * @param refs - reference parameters
   */
  private _serializeNamespaces(preNode: PreSerializedNode<Node>,
    options: StringWriterOptions, refs: StringWriterRefs): string {
    let markup = ''
    for (const preNS of preNode.namespaces) {
      markup += ` ${this._serializeNamespace(preNS, options, refs)}`
    }
    return markup
  }

  /**
   * Produces an XML serialization of a document node.
   * 
   * @param preNode - current node
   * @param options - serialization options
   * @param refs - reference parameters
   */
  private _serializeDocument(preNode: PreSerializedNode<XMLDocument>,
    options: StringWriterOptions, refs: StringWriterRefs): string {
    let markup = ''

    if (!options.headless) {
      markup = `${this._beginLine(preNode, options, refs)}<?xml`
      markup += ` version="${this._builderOptions.version}"`
      if (this._builderOptions.encoding !== undefined) {
        markup += ` encoding="${this._builderOptions.encoding}"`
      }
      if (this._builderOptions.standalone !== undefined) {
        markup += ` standalone="${this._builderOptions.standalone ? "yes" : "no"}"`
      }
      markup += `?>${this._endLine(preNode, options, refs)}`
    }

    markup += this._serializeChildNodes(preNode, options, refs)

    return markup
  }

  /**
   * Produces an XML serialization of a document type node.
   * 
   * @param preNode - current node
   * @param options - serialization options
   * @param refs - reference parameters
   */
  private _serializeDocumentType(preNode: PreSerializedNode<DocumentType>,
    options: StringWriterOptions, refs: StringWriterRefs): string {
    let markup = this._beginLine(preNode, options, refs)

    if (preNode.node.publicId && preNode.node.systemId) {
      markup += `<!DOCTYPE ${preNode.node.name} PUBLIC "${preNode.node.publicId}" "${preNode.node.systemId}">`
    } else if (preNode.node.publicId) {
      markup += `<!DOCTYPE ${preNode.node.name} PUBLIC "${preNode.node.publicId}">`
    } else if (preNode.node.systemId) {
      markup += `<!DOCTYPE ${preNode.node.name} SYSTEM "${preNode.node.systemId}">`
    } else {
      markup += `<!DOCTYPE ${preNode.node.name}>`
    }

    markup += this._endLine(preNode, options, refs)
    return markup
  }

  /**
   * Produces an XML serialization of a document fragment node.
   * 
   * @param preNode - current node
   * @param options - serialization options
   * @param refs - reference parameters
   */
  private _serializeDocumentFragment(preNode: PreSerializedNode<DocumentFragment>,
    options: StringWriterOptions, refs: StringWriterRefs): string {
    return this._serializeChildNodes(preNode, options, refs)
  }

  /**
   * Produces an XML serialization of an element node.
   * 
   * @param preNode - current node
   * @param options - serialization options
   * @param refs - reference parameters
   */
  private _serializeElement(preNode: PreSerializedNode<Element>,
    options: StringWriterOptions, refs: StringWriterRefs): string {
    // opening tag
    let markup = this._beginLine(preNode, options, refs) + '<' + preNode.name
    // serialize namespaces
    markup += this._serializeNamespaces(preNode, options, refs)
    // serialize attributes
    markup += this._serializeAttributes(preNode, options, refs)

    if (preNode.children.length === 0 ||
      preNode.children.every((e) =>
        e.node.nodeType === NodeType.Text && (<Text>e.node).data === '')) {
      // self closing tag
      if (options.allowEmptyTags) {
        markup += `></${preNode.name}>${this._endLine(preNode, options, refs)}`
      } else {
        if (options.spaceBeforeSlash) {
          markup += ' '
        }
        markup += `/>${this._endLine(preNode, options, refs)}`
      }
    } else if (options.prettyPrint && preNode.children.length === 1 && 
      preNode.children[0].node.nodeType === NodeType.Text && 
      (<Text>preNode.children[0].node).data !== '') {
      // do not indent text-only nodes
      markup += '>'
      refs.suppressPrettyCount++
      markup += this._serializeNode(preNode.children[0], options, refs)
      refs.suppressPrettyCount--
      markup += `</${preNode.name}>${this._endLine(preNode, options, refs)}`
    } else {
      let prettySuppressed = false

      // if ANY are a text node, then suppress pretty now
      if (options.dontPrettyPrintTextNodes) {
        for (const child of preNode.children) {
          if (child.node.nodeType === NodeType.Text && (<Text>child.node).data !== '') {
            refs.suppressPrettyCount++
            prettySuppressed = true
            break
          }
        }
      }

      markup += `>${this._endLine(preNode, options, refs)}`

      // serialize child-nodes
      markup += this._serializeChildNodes(preNode, options, refs)

      // closing tag
      markup += `${this._beginLine(preNode, options, refs)}</${preNode.name}>`

      if (prettySuppressed) {
        refs.suppressPrettyCount--
      }      

      markup += `${this._endLine(preNode, options, refs)}`
    }

    return markup
  }

  /**
   * Produces an XML serialization of a text node.
   * 
   * @param preNode - current node
   * @param options - serialization options
   * @param refs - reference parameters
   */
  private _serializeText(preNode: PreSerializedNode<Text>,
    options: StringWriterOptions, refs: StringWriterRefs): string {
    return this._beginLine(preNode, options, refs) +
      Char.escapeText(preNode.node.data) +
      this._endLine(preNode, options, refs)
  }

  /**
   * Produces an XML serialization of a raw text node.
   * 
   * @param preNode - current node
   * @param options - serialization options
   * @param refs - reference parameters
   */
  private _serializeRaw(preNode: PreSerializedNode<Text>,
    options: StringWriterOptions, refs: StringWriterRefs): string {
    return this._beginLine(preNode, options, refs) +
      preNode.node.data +
      this._endLine(preNode, options, refs)
  }

  /**
   * Produces an XML serialization of a CDATA node.
   * 
   * @param preNode - current node
   * @param options - serialization options
   * @param refs - reference parameters
   */
  private _serializeCdata(preNode: PreSerializedNode<CDATASection>,
    options: StringWriterOptions, refs: StringWriterRefs): string {
    return `${this._beginLine(preNode, options, refs)}<![CDATA[${preNode.node.data}]]>${this._endLine(preNode, options, refs)}`
  }

  /**
   * Produces an XML serialization of a comment node.
   * 
   * @param preNode - current node
   * @param options - serialization options
   * @param refs - reference parameters
   */
  private _serializeComment(preNode: PreSerializedNode<Comment>,
    options: StringWriterOptions, refs: StringWriterRefs): string {
    return `${this._beginLine(preNode, options, refs)}<!--${preNode.node.data}-->${this._endLine(preNode, options, refs)}`
  }

  /**
   * Produces an XML serialization of a processing instruction node.
   * 
   * @param preNode - current node
   * @param options - serialization options
   * @param refs - reference parameters
   */
  private _serializeProcessingInstruction(preNode: PreSerializedNode<ProcessingInstruction>,
    options: StringWriterOptions, refs: StringWriterRefs): string {
    return `${this._beginLine(preNode, options, refs)}<?${preNode.node.target} ${preNode.node.data}?>${this._endLine(preNode, options, refs)}`
  }

  /**
   * Produces an XML serialization of an attribute.
   * 
   * @param preNode - current node
   * @param options - serialization options
   * @param refs - reference parameters
   */
  private _serializeAttribute(preAttr: PreSerializedAttr,
    options: StringWriterOptions, refs: StringWriterRefs): string {
    return `${preAttr.name}="${Char.escapeAttrValue(preAttr.value)}"`
  }

  /**
   * Produces an XML serialization of a namespace declaration.
   * 
   * @param preNode - current node
   * @param options - serialization options
   * @param refs - reference parameters
   */
  private _serializeNamespace(preNS: PreSerializedNS,
    options: StringWriterOptions, refs: StringWriterRefs): string {
    return `${preNS.name}="${Char.escapeAttrValue(preNS.value)}"`
  }

  /**
   * Produces characters to be prepended to a line of string in pretty-print
   * mode.
   * 
   * @param preNode - current node
   * @param options - serialization options
   * @param refs - reference parameters
   */
  private _beginLine(preNode: PreSerializedNode<Node>,
    options: StringWriterOptions, refs: StringWriterRefs): string {
    if (!options.prettyPrint || refs.suppressPrettyCount > 0) {
      return ''
    } else if (options.prettyPrint) {
      const indentLevel = options.offset + preNode.level + 1
      if (indentLevel > 0) {
        return new Array(indentLevel).join(options.indent)
      }
    }

    return ''
  }

  /**
   * Produces characters to be appended to a line of string in pretty-print
   * mode.
   * 
   * @param preNode - current node
   * @param options - serialization options
   * @param refs - reference parameters
   */
  private _endLine(preNode: PreSerializedNode<Node>,
    options: StringWriterOptions, refs: StringWriterRefs): string {
    if (!options.prettyPrint || refs.suppressPrettyCount > 0) {
      return ''
    } else {
      return options.newline
    }
  }

}