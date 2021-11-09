import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import {Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { LoadingController, Platform } from '@ionic/angular';
import {finalize} from "rxjs/operators";


const IMAGE_DIR = 'stored-images';

interface LocalFile {
  name: string;
  path: string;
  data: string;
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit{
  images: LocalFile[] = [];

  constructor(private platform : Platform,private loadingCtrl:LoadingController,private http:HttpClient) {}

  async ngOnInit(){
    this.loadFiles();
  }

  async loadFiles(){
    this.images = [];

    const loading = await this.loadingCtrl.create({
      message:'keep calm and load image..'
    });

    await loading.present();

    Filesystem.readdir({
      directory: Directory.Data,
      path:IMAGE_DIR
    }).then((result)=>{
      console.log('result data loaded,',result);
      this.loadFileData(result.files);
    }, async err => {
      console.log('err:',err);
      await Filesystem.mkdir({
        directory: Directory.Data,
        path: IMAGE_DIR
      })
    }).then(_=>loading.dismiss())

  }

  async loadFileData(fileNames: string[]){
    for(let i of fileNames){
      const filePath = `${IMAGE_DIR}/${i}`;
      const readFile = await Filesystem.readFile({
        directory:Directory.Data,
        path: filePath
      });

      this.images.push({
        name:i,
        path: filePath,
        data: `data:image/jpeg;base64,${readFile.data}`
      })
      console.log('READ:',readFile);
    }

  }

  async selectImage(){
    const image = await Camera.getPhoto({
      quality:90,
      allowEditing:false,
      resultType:CameraResultType.Uri,
      source: CameraSource.Photos
    });

    if(image){
      console.log(image);
      this.saveImage(image);
    }
  }

  async saveImage(photo: Photo){
    const base64Data = await this.readAsBase64(photo);
      console.log(base64Data);
      const fileName = new Date().getTime() + '.jpeg';
      const savedFile = await Filesystem.writeFile({
        directory:  Directory.Data,
        path: `${IMAGE_DIR}/${fileName}`,
        data: base64Data
      });
      console.log('saved: ',savedFile);
  }

  async readAsBase64(photo: Photo): Promise<string>{
    if(this.platform.is('hybrid')){
      const file = await Filesystem.readFile({
        path: photo.path
      });

      return file.data;
    }else{
      const response = await fetch(photo.webPath);
      const blob = await response.blob();

      const file = await this.convertBlobToBase64(blob) as string;

      return file;
    }
  }

  async convertBlobToBase64(blob: Blob) {return new Promise((resolve, reject) => {
    const reader = new FileReader;
    reader.onerror = reject;
    reader.onload =  ()=> {
      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  })}

  async startUpload(file: LocalFile){
    const response = await fetch(file.data);
    const blob = await response.blob();
    const formData =  new FormData();
    formData.append('file',blob, file.name);
    this.uploadData(formData);
  }

  async uploadData(formData: FormData){
    const loading = await this.loadingCtrl.create({
      message: 'Uploading image...'
    });

    await loading.present();

    const url = 'https://imagnager.herokuapp.com/upload.php';

    this.http.post(url,formData).pipe(
      finalize(()=>{
        loading.dismiss();
      })
    ).subscribe(res=>{
      console.log(res);
    })

  }

  async deleteImage(file: LocalFile){
    await Filesystem.deleteFile({
      directory:Directory.Data,
      path: file.path
    });

  }

}
