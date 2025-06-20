import { Cuboid as Cube, Zap } from 'lucide-react';

export function Header() {
  return (
    <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Cube className="h-8 w-8 text-blue-600" />
              <Zap className="h-4 w-4 text-orange-500 absolute -top-1 -right-1" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">3D to GIF</h1>
              <p className="text-sm text-gray-600">Convert 3D models to animated GIFs</p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center space-x-6 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>OBJ, FBX, GLB, GLTF</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span>ZIP Support</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}