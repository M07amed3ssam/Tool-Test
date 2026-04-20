import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Copy, ChevronDown, ChevronRight } from 'lucide-react';

const JsonViewer = ({ data, title, maxDepth = 2, expandAll = false }) => {
  const [expandedPaths, setExpandedPaths] = useState({});
  const [copied, setCopied] = useState(false);

  // Function to toggle expanded state for a path
  const toggleExpand = (path) => {
    setExpandedPaths(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  // Function to check if a path is expanded
  const isExpanded = (path) => {
    return expandAll || expandedPaths[path] === true;
  };

  // Function to copy JSON to clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Function to render a JSON value
  const renderValue = (value, path = '', depth = 0) => {
    if (value === null) {
      return <span className="text-gray-500">null</span>;
    }

    if (value === undefined) {
      return <span className="text-gray-500">undefined</span>;
    }

    if (typeof value === 'boolean') {
      return <span className="text-blue-600">{value.toString()}</span>;
    }

    if (typeof value === 'number') {
      return <span className="text-green-600">{value}</span>;
    }

    if (typeof value === 'string') {
      return <span className="text-orange-600">"{value}"</span>;
    }

    if (Array.isArray(value)) {
      if (depth >= maxDepth && !isExpanded(path)) {
        return (
          <div className="flex items-center">
            <button 
              onClick={() => toggleExpand(path)} 
              className="mr-1 p-1 hover:bg-gray-100 rounded"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
            <span className="text-gray-500">[Array({value.length})]</span>
          </div>
        );
      }

      return (
        <div>
          <div className="flex items-center">
            <button 
              onClick={() => toggleExpand(path)} 
              className="mr-1 p-1 hover:bg-gray-100 rounded"
            >
              {isExpanded(path) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
            <span>[</span>
          </div>
          
          {isExpanded(path) && (
            <div className="pl-4 border-l border-gray-200">
              {value.map((item, index) => (
                <div key={index} className="py-1">
                  {renderValue(item, `${path}.${index}`, depth + 1)}
                  {index < value.length - 1 && <span>,</span>}
                </div>
              ))}
            </div>
          )}
          
          <div>]</div>
        </div>
      );
    }

    if (typeof value === 'object') {
      const keys = Object.keys(value);
      
      if (depth >= maxDepth && !isExpanded(path)) {
        return (
          <div className="flex items-center">
            <button 
              onClick={() => toggleExpand(path)} 
              className="mr-1 p-1 hover:bg-gray-100 rounded"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
            <span className="text-gray-500">{`{Object: ${keys.length} ${keys.length === 1 ? 'property' : 'properties'}}`}</span>
          </div>
        );
      }

      return (
        <div>
          <div className="flex items-center">
            <button 
              onClick={() => toggleExpand(path)} 
              className="mr-1 p-1 hover:bg-gray-100 rounded"
            >
              {isExpanded(path) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
            <span>{"{"}  </span>
          </div>
          
          {isExpanded(path) && (
            <div className="pl-4 border-l border-gray-200">
              {keys.map((key, index) => (
                <div key={key} className="py-1">
                  <span className="text-purple-600">"{key}"</span>: {renderValue(value[key], `${path}.${key}`, depth + 1)}
                  {index < keys.length - 1 && <span>,</span>}
                </div>
              ))}
            </div>
          )}
          
          <div>}</div>
        </div>
      );
    }

    return <span>{String(value)}</span>;
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-md font-medium">{title || 'JSON Data'}</CardTitle>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={copyToClipboard} 
          className="h-8 px-2 text-xs"
        >
          <Copy className="h-3 w-3 mr-1" />
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="bg-gray-50 p-4 rounded-md overflow-auto max-h-[500px] text-sm font-mono">
          {renderValue(data, 'root', 0)}
        </div>
      </CardContent>
    </Card>
  );
};

export default JsonViewer;