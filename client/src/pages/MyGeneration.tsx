
import { useEffect, useState } from "react";
import {  type IThumbnail } from "../assets/assets";
import SoftBackdrop from "../components/SoftBackdrop";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRightIcon, DownloadIcon, TrashIcon } from "lucide-react";
import toast from "react-hot-toast";
import api from "../configs/api";

const MyGeneration = () => {
    
    

    const aspectRatioClassMap : Record<string,string> = {
        '16:9' : 'aspect-video' ,
        '1:1' : 'aspect-square',
        '9:16' : 'aspect-[9/16]',

    }
    const [thumbnails,setThumbnails] = useState<IThumbnail[]>([])
    const [loading, setLoading] = useState(false)

    const navigate = useNavigate()

    const fetchThumbnails = async () =>{
        try{
            setLoading(true)
            const {data} = await api.get('/api/user/thumbnails')
            setThumbnails(data.thumbnails || [])
        } catch(error: any){
            console.error(error);
            toast.error(error?.response?.data?.message || error.message)
        }
        finally{
            setLoading(false)
        }
    }

    
    useEffect(() => {
    fetchThumbnails();
    }, []);



    const handleDownload = async (image_url: string, title?: string) => {
        try {
            const response = await fetch(image_url);
            const blob = await response.blob();

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = url;
            link.download = `${title || "thumbnail"}.png`; // file name
            document.body.appendChild(link);
            link.click();

            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Download failed:", error);
            toast.error("Failed to download image");
        }
    };


    const handleDelete = async (id: string) => {
        try {
            await api.delete(`/api/thumbnail/${id}`);

            // remove from UI instantly
            setThumbnails(prev => prev.filter(t => t._id !== id));

            toast.success("Thumbnail deleted successfully");
        } catch (error: any) {
            console.error(error);
            toast.error(error?.response?.data?.message || "Failed to delete thumbnail");
        }
    };

    return (
        <>
            <SoftBackdrop />
            <div className="mt-32 min-h-screen px-6 lg:px-24 xl:px-32">
            {/*HEADER */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-zinc-200">My Generations</h1>
                    <p className="text-sm text-zinc-400 mt-1">View and Manage all your AI-generated thumbnails</p>
                </div>

                {/*LOADING*/}
                {loading && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Array.from({length:6}).map((_,i)=>(
                            <div key={i} className="rounded-2xl bg-white/6 border border-white/10 animate-pulse h-[260px]" />

                        ))}

                    </div>
                )}
                {/*Empty State */}
                {!loading && thumbnails.length === 0 && (
                    <div className="text-center py-24">
                        <h3 className="text-lg font-semibold text-zinc-200">No thumbnails yet</h3>
                        <p className="text-sm text-zinc-400 mt-2">Generate your first thumbnail to see it here</p>
                    </div>
                )}

                {/*GRID */}
                {!loading && thumbnails.length >0  && (
                    <div className="columns-1 sm:columns-2 lg:columns-3 2xl:columns-4 gap-8">
                        {thumbnails.map((thumb: IThumbnail)=>{
                            const aspectClass = aspectRatioClassMap[thumb.aspect_ratio || '16:9'];
                            return (
                                <div key={thumb._id} onClick={()=> navigate(`/generate/${thumb._id}`)} className="mb-8 group relative cursor-pointer rounded-2xl bg-white/6 border border-white/10 transition shadow-xl break-inside-avoid">
                                    {/* IMAGE*/}
                                    <div className={`relative overflow-hidden rounded-t-2xl ${aspectClass} bg-black`}>
                                        {thumb.image_url ? (
                                            <img src={thumb.image_url} alt={thumb.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>

                                        ):( 
                                            <div className="w-full h-full flex items-center justify-center text-sm text-zinc-400">
                                                {thumb.isGenerating ? 'Generating...' : 'No image'}
                                            </div>

                                        )}
                                        
                                        {thumb.isGenerating && <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-sm font-medium text-white">Generating...</div>}

                                    </div>
                                    {/*CONTENT */}
                                    <div className="p-4 space-y-2">
                                        <h3 className="text-sm font-semibold text-zinc-100 line-clamp-2">{thumb.title}</h3>
                                        <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                                            <span className="px-2 py-0.5 rounded bg-white/8">{thumb.style}</span>
                                            <span className="px-2 py-0.5 rounded bg-white/8">{thumb.color_scheme}</span>
                                            <span className="px-2 py-0.5 rounded bg-white/8">{thumb.aspect_ratio}</span>
                                        </div>
                                        <p className="text-xs text-zinc-500">{new Date(thumb.createdAt!).toDateString()}</p>
                                    </div>
                                    <div onClick={(e)=>e.stopPropagation()} className="absolute bottom-2 right-2 max-sm:flex sm:hidden group-hover:flex gap-1.5">
                                        <TrashIcon onClick={(e) => { e.stopPropagation(); handleDelete(thumb._id); }} className="size-6 bg-black/50 p-1 rounded hover:bg-pink-600" />
                                        <DownloadIcon  onClick={()=> handleDownload(thumb.image_url!)}  className="size-6 bg-black/50 p-1 rounded hover:bg-pink-600 transition-all"/>
                                        <Link target="_blank" to={`/preview?thumbnail_url=${thumb.image_url}&title=${thumb.title}`}>
                                            <ArrowUpRightIcon  className="size-6 bg-black/50 p-1 rounded hover:bg-pink-600 transition-all"/>
                                        </Link>
                                        
                                    </div>
                                </div>
                            )
                        })}

                    </div>
                )}
            </div>
        </>
    )
}

export default MyGeneration